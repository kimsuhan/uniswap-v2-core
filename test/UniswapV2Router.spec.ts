import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC20, UniswapV2Factory, UniswapV2Pair, UniswapV2Router, WETH } from '../typechain-types'

async function deployRouterFixture() {
  const [owner] = await ethers.getSigners()
  const factoryContract = await ethers.getContractFactory('UniswapV2Factory')
  const factory = await factoryContract.deploy(owner.address)
  await factory.waitForDeployment()

  const tokenAContract = await ethers.getContractFactory('ERC20')
  let tokenA = await tokenAContract.deploy(BigInt(10000 * 10 ** 18))
  await tokenA.waitForDeployment()

  const tokenBContract = await ethers.getContractFactory('ERC20')
  let tokenB = await tokenBContract.deploy(BigInt(10000 * 10 ** 18))
  await tokenB.waitForDeployment()

  const wethContract = await ethers.getContractFactory('WETH')
  const weth = await wethContract.deploy()
  await weth.waitForDeployment()

  const routerContract = await ethers.getContractFactory('UniswapV2Router')
  const router = await routerContract.deploy(await factory.getAddress(), await weth.getAddress())
  await router.waitForDeployment()

  // const pairContract = await ethers.getContractFactory('UniswapV2Pair')
  const createPair = await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress())

  const pairAddress = await factory.getPair(tokenA.getAddress(), tokenB.getAddress())
  const pair = await ethers.getContractAt('UniswapV2Pair', pairAddress)

  const token0 = await pair.token0()

  // 토큰 순서가 바뀔 수 있으므로 토큰 순서 조정
  if (token0 !== (await tokenA.getAddress())) {
    let tempToken = tokenA
    tokenA = tokenB
    tokenB = tempToken
  }

  return { owner, factory, tokenA, tokenB, weth, router, pair }
}

describe('UniswapV2Router', () => {
  let owner: HardhatEthersSigner
  let tokenA: ERC20
  let tokenB: ERC20
  let factory: UniswapV2Factory
  let weth: WETH
  let router: UniswapV2Router
  let pair: UniswapV2Pair

  beforeEach(async () => {
    const signers = await ethers.getSigners()
    owner = signers[0]

    const fixture = await loadFixture(deployRouterFixture)
    factory = fixture.factory
    owner = fixture.owner
    tokenA = fixture.tokenA
    tokenB = fixture.tokenB
    weth = fixture.weth
    router = fixture.router
    pair = fixture.pair
  })

  it('factory, WETH 주소 확인', async () => {
    expect(await router.factory()).to.eq(await factory.getAddress())
    expect(await router.WETH()).to.eq(await weth.getAddress())
  })

  it('풀 추가 테스트', async () => {
    const token0Amount = ethers.parseEther('1')
    const token1Amount = ethers.parseEther('4')
    const expectedLiquidity = ethers.parseEther('2')
    await tokenA.approve(await router.getAddress(), ethers.MaxUint256)
    await tokenB.approve(await router.getAddress(), ethers.MaxUint256)
    await expect(
      router.addLiquidity(
        tokenA.getAddress(),
        tokenB.getAddress(),
        token0Amount,
        token1Amount,
        0,
        0,
        owner.address,
        ethers.MaxUint256
      )
    )
      .to.emit(tokenA, 'Transfer')
      .withArgs(owner.address, await pair.getAddress(), token0Amount)
      .to.emit(tokenB, 'Transfer')
      .withArgs(owner.address, await pair.getAddress(), token1Amount)
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, 1000n)
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, owner.address, expectedLiquidity - 1000n)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(await router.getAddress(), token0Amount, token1Amount)

    // 수수료를 제외한 나의 유동성 풀 잔액 조회
    expect(await pair.balanceOf(owner.address)).to.eq(expectedLiquidity - 1000n)

    // 풀에 들어간 잔액 조회
    const pairReserves = await pair.getReserves()
    expect(pairReserves[0]).to.eq(token0Amount)
    expect(pairReserves[1]).to.eq(token1Amount)
  })
})
