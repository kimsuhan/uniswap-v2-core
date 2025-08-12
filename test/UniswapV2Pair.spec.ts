import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ERC20, UniswapV2Factory, UniswapV2Pair } from '../typechain-types'

const MINIMUM_LIQUIDITY = BigInt(10) ** BigInt(3)
const overrides = {
  gasLimit: 9999999,
}

async function deployFactory() {
  const [owner] = await ethers.getSigners()
  const factoryContract = await ethers.getContractFactory('UniswapV2Factory')
  const factory = await factoryContract.deploy(owner.address)
  await factory.waitForDeployment()
  return { factory, owner }
}

async function deployTokenA() {
  const tokenContract = await ethers.getContractFactory('ERC20')
  const token = await tokenContract.deploy(BigInt(10000 * 10 ** 18))
  await token.waitForDeployment()
  return { token }
}

async function deployTokenB() {
  const tokenContract = await ethers.getContractFactory('ERC20')
  const token = await tokenContract.deploy(BigInt(10000 * 10 ** 18))
  await token.waitForDeployment()
  return { token }
}

describe('UniswapV2Pair', () => {
  let token: ERC20
  let owner: HardhatEthersSigner
  let tokenA: ERC20
  let tokenB: ERC20
  let factory: UniswapV2Factory
  let pair: UniswapV2Pair
  let pairAddress: string

  beforeEach(async () => {
    const signers = await ethers.getSigners()
    owner = signers[0]

    const fixture = await loadFixture(deployFactory)
    factory = fixture.factory
    owner = fixture.owner

    const { token: tokenAFixture } = await loadFixture(deployTokenA)
    const { token: tokenBFixture } = await loadFixture(deployTokenB)

    const tx = await factory.createPair(tokenAFixture.getAddress(), tokenBFixture.getAddress())
    await tx.wait()

    pairAddress = await factory.getPair(tokenAFixture.getAddress(), tokenBFixture.getAddress())
    pair = await ethers.getContractAt('UniswapV2Pair', pairAddress)

    // 토큰 0과 토큰 1의 주소를 조회하여 토큰 A와 토큰 B를 결정
    const token0Address = await pair.token0()
    tokenA = (await tokenAFixture.getAddress()) === token0Address ? tokenAFixture : tokenBFixture
    tokenB = (await tokenAFixture.getAddress()) === token0Address ? tokenBFixture : tokenAFixture
  })

  it('유동성 추가 기본 테스트', async () => {
    const tokenAAmount = BigInt(ethers.parseEther('1')) // tokenA 에 1 토큰
    const tokenBAmount = BigInt(ethers.parseEther('4')) // tokenB 에 4 토큰

    await tokenA.connect(owner).transfer(pairAddress, tokenAAmount) // tokenA 에서 pairContract로 1토큰을 미리 전송
    await tokenB.connect(owner).transfer(pairAddress, tokenBAmount) // tokenB 에서 pairContract로 4토큰을 미리 전송

    const expectedLiquidity = ethers.parseEther('2') // 1토큰 * 4토큰 의 제곱근 = 2토큰 (이거 계산하기 귀찮아서 걍 넣어논듯 테스트니까?)
    await expect(pair.mint(owner.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, MINIMUM_LIQUIDITY) // 최초의 유동성 풀 생성이므로 최소값을 zero to zero(pair to pair)로 최소값 민팅
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, owner.address, expectedLiquidity - MINIMUM_LIQUIDITY) // 보낸 사람한테 유동성 토큰을 민팅 (하지만 최소값은 제외 한)
      .to.emit(pair, 'Sync')
      .withArgs(tokenAAmount, tokenBAmount) // 토큰 0 풀 잔액과 토큰 1 풀 잔액 업데이트
      .to.emit(pair, 'Mint')
      .withArgs(owner.address, tokenAAmount, tokenBAmount) // 너 이렇게 민팅됬어 라는 이벤트다.

    expect(await pair.totalSupply()).to.eq(expectedLiquidity) // 토큰 총 공급량 = 내가 넣은 토큰의 제곱근
    expect(await pair.balanceOf(owner.address)).to.eq(expectedLiquidity - MINIMUM_LIQUIDITY) // 내가 넣은 값에 최소값을 뺀게 내 유동성 토큰 잔액이 맞는지
    expect(await tokenA.balanceOf(pairAddress)).to.eq(tokenAAmount) // 토큰 0 풀 잔액이 맞는지
    expect(await tokenB.balanceOf(pairAddress)).to.eq(tokenBAmount) // 토큰 1 풀 잔액이 맞는지

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(tokenAAmount) // 토큰 0 풀 잔액이 맞는지
    expect(reserves[1]).to.eq(tokenBAmount) // 토큰 1 풀 잔액이 맞는지
  })

  /**
   * 유동성 추가
   *
   * 기본 테스트는 지났으니 이후에 유동성 추가할 일이 있으면 이 함수를 통해 유동성 추가 테스트를 진행할 수 있음
   *
   * @param tokenAAmount tokenA 에 넣을 토큰 양
   * @param tokenBAmount tokenB 에 넣을 토큰 양
   */
  async function addLiquidity(tokenAAmount: bigint, tokenBAmount: bigint) {
    await tokenA.transfer(pairAddress, tokenAAmount)
    await tokenB.transfer(pairAddress, tokenBAmount)
    await pair.mint(owner.address, overrides)
  }

  /**
   * 스왑 테스트
   *
   */
  const swapTestCases: [number, number, number, bigint][] = [
    [1, 5, 10, 1662497915624478906n],
    [1, 10, 5, 453305446940074565n],

    [2, 5, 10, 2851015155847869602n],
    [2, 10, 5, 831248957812239453n],

    [1, 10, 10, 906610893880149131n],
    [1, 100, 100, 987158034397061298n],
    [1, 1000, 1000, 996006981039903216n],
  ]

  const swapTestCase: {
    swapAmount: string // 스왑할 토큰 A 양
    tokenAAmount: string // 최초 유동성 풀에 넣을 토큰 0 양
    tokenBAmount: string // 최초 유동성 풀에 넣을 토큰 1 양
    expectedOutputAmount: bigint // 예상 출력량
  }[] = [
    { swapAmount: '1', tokenAAmount: '5', tokenBAmount: '10', expectedOutputAmount: 1662497915624478906n },
    { swapAmount: '1', tokenAAmount: '10', tokenBAmount: '5', expectedOutputAmount: 453305446940074565n },
    { swapAmount: '2', tokenAAmount: '5', tokenBAmount: '10', expectedOutputAmount: 2851015155847869602n },
    { swapAmount: '2', tokenAAmount: '10', tokenBAmount: '5', expectedOutputAmount: 831248957812239453n },
    { swapAmount: '1', tokenAAmount: '10', tokenBAmount: '10', expectedOutputAmount: 906610893880149131n },
    { swapAmount: '1', tokenAAmount: '100', tokenBAmount: '100', expectedOutputAmount: 987158034397061298n },
    { swapAmount: '1', tokenAAmount: '1000', tokenBAmount: '1000', expectedOutputAmount: 996006981039903216n },
  ]
  swapTestCase.forEach((swapTestCase, i) => {
    it(`${i + 1}번째 스왑 테스트`, async () => {
      const { swapAmount, tokenAAmount, tokenBAmount, expectedOutputAmount } = swapTestCase

      // 1. 유동성 추가
      await addLiquidity(BigInt(ethers.parseEther(tokenAAmount)), BigInt(ethers.parseEther(tokenBAmount)))

      // 2. 스왑할 토큰을 미리 전송
      await tokenA.transfer(pairAddress, BigInt(ethers.parseEther(swapAmount)))

      // 3. 스왑 하려고 하지만 예상 출력량보다 1 더 큰 값을 출력하려고 하면 에러가 발생함
      await expect(pair.swap(0, expectedOutputAmount + 1n, owner.address, '0x', overrides)).to.be.revertedWith(
        'UniswapV2: K'
      )

      // 4. 진짜 스왑 하기
      await pair.swap(0, expectedOutputAmount, owner.address, '0x', overrides)

      const reserves = await pair.getReserves()
      console.log('-------------------------------------')
      console.log('[Test] reserves > ', reserves)
      console.log('-------------------------------------')
    })
  })

  // const optimisticTestCases: bigint[][] = [
  //   ['997000000000000000', 5, 10, 1], // given amountIn, amountOut = floor(amountIn * .997)
  //   ['997000000000000000', 10, 5, 1],
  //   ['997000000000000000', 5, 5, 1],
  //   [1, 5, 5, '1003009027081243732'], // given amountOut, amountIn = ceiling(amountOut / .997)
  // ].map((a) => a.map((n) => (typeof n === 'string' ? BigInt(n) : BigInt(ethers.parseEther(String(n))))))
  // optimisticTestCases.forEach((optimisticTestCase, i) => {
  //   it(`optimistic:${i}`, async () => {
  //     const [outputAmount, tokenAAmount, tokenBAmount, inputAmount] = optimisticTestCase
  //     await addLiquidity(tokenAAmount, tokenBAmount)
  //     await tokenA.transfer(pairAddress, inputAmount)
  //     await expect(pair.swap(outputAmount + 1n, 0, owner.address, '0x', overrides)).to.be.revertedWith('UniswapV2: K')
  //     await pair.swap(outputAmount, 0, owner.address, '0x', overrides)
  //   })
  // })

  // it('swap:token0', async () => {
  //   const token0Amount = expandTo18Decimals(5)
  //   const token1Amount = expandTo18Decimals(10)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const swapAmount = expandTo18Decimals(1)
  //   const expectedOutputAmount = bigNumberify('1662497915624478906')
  //   await token0.transfer(pair.address, swapAmount)
  //   await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides))
  //     .to.emit(token1, 'Transfer')
  //     .withArgs(pair.address, wallet.address, expectedOutputAmount)
  //     .to.emit(pair, 'Sync')
  //     .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
  //     .to.emit(pair, 'Swap')
  //     .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)

  //   const reserves = await pair.getReserves()
  //   expect(reserves[0]).to.eq(token0Amount.add(swapAmount))
  //   expect(reserves[1]).to.eq(token1Amount.sub(expectedOutputAmount))
  //   expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.add(swapAmount))
  //   expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.sub(expectedOutputAmount))
  //   const totalSupplyToken0 = await token0.totalSupply()
  //   const totalSupplyToken1 = await token1.totalSupply()
  //   expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).sub(swapAmount))
  //   expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount))
  // })

  // it('swap:token1', async () => {
  //   const token0Amount = expandTo18Decimals(5)
  //   const token1Amount = expandTo18Decimals(10)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const swapAmount = expandTo18Decimals(1)
  //   const expectedOutputAmount = bigNumberify('453305446940074565')
  //   await token1.transfer(pair.address, swapAmount)
  //   await expect(pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides))
  //     .to.emit(token0, 'Transfer')
  //     .withArgs(pair.address, wallet.address, expectedOutputAmount)
  //     .to.emit(pair, 'Sync')
  //     .withArgs(token0Amount.sub(expectedOutputAmount), token1Amount.add(swapAmount))
  //     .to.emit(pair, 'Swap')
  //     .withArgs(wallet.address, 0, swapAmount, expectedOutputAmount, 0, wallet.address)

  //   const reserves = await pair.getReserves()
  //   expect(reserves[0]).to.eq(token0Amount.sub(expectedOutputAmount))
  //   expect(reserves[1]).to.eq(token1Amount.add(swapAmount))
  //   expect(await token0.balanceOf(pair.address)).to.eq(token0Amount.sub(expectedOutputAmount))
  //   expect(await token1.balanceOf(pair.address)).to.eq(token1Amount.add(swapAmount))
  //   const totalSupplyToken0 = await token0.totalSupply()
  //   const totalSupplyToken1 = await token1.totalSupply()
  //   expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount))
  //   expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(token1Amount).sub(swapAmount))
  // })

  // it('swap:gas', async () => {
  //   const token0Amount = expandTo18Decimals(5)
  //   const token1Amount = expandTo18Decimals(10)
  //   await addLiquidity(token0Amount, token1Amount)

  //   // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
  //   await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
  //   await pair.sync(overrides)

  //   const swapAmount = expandTo18Decimals(1)
  //   const expectedOutputAmount = bigNumberify('453305446940074565')
  //   await token1.transfer(pair.address, swapAmount)
  //   await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
  //   const tx = await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)
  //   const receipt = await tx.wait()
  //   expect(receipt.gasUsed).to.eq(73462)
  // })

  // it('burn', async () => {
  //   const token0Amount = expandTo18Decimals(3)
  //   const token1Amount = expandTo18Decimals(3)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const expectedLiquidity = expandTo18Decimals(3)
  //   await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  //   await expect(pair.burn(wallet.address, overrides))
  //     .to.emit(pair, 'Transfer')
  //     .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  //     .to.emit(token0, 'Transfer')
  //     .withArgs(pair.address, wallet.address, token0Amount.sub(1000))
  //     .to.emit(token1, 'Transfer')
  //     .withArgs(pair.address, wallet.address, token1Amount.sub(1000))
  //     .to.emit(pair, 'Sync')
  //     .withArgs(1000, 1000)
  //     .to.emit(pair, 'Burn')
  //     .withArgs(wallet.address, token0Amount.sub(1000), token1Amount.sub(1000), wallet.address)

  //   expect(await pair.balanceOf(wallet.address)).to.eq(0)
  //   expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  //   expect(await token0.balanceOf(pair.address)).to.eq(1000)
  //   expect(await token1.balanceOf(pair.address)).to.eq(1000)
  //   const totalSupplyToken0 = await token0.totalSupply()
  //   const totalSupplyToken1 = await token1.totalSupply()
  //   expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(1000))
  //   expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(1000))
  // })

  // it('price{0,1}CumulativeLast', async () => {
  //   const token0Amount = expandTo18Decimals(3)
  //   const token1Amount = expandTo18Decimals(3)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const blockTimestamp = (await pair.getReserves())[2]
  //   await mineBlock(provider, blockTimestamp + 1)
  //   await pair.sync(overrides)

  //   const initialPrice = encodePrice(token0Amount, token1Amount)
  //   expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0])
  //   expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1])
  //   expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 1)

  //   const swapAmount = expandTo18Decimals(3)
  //   await token0.transfer(pair.address, swapAmount)
  //   await mineBlock(provider, blockTimestamp + 10)
  //   // swap to a new price eagerly instead of syncing
  //   await pair.swap(0, expandTo18Decimals(1), wallet.address, '0x', overrides) // make the price nice

  //   expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0].mul(10))
  //   expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1].mul(10))
  //   expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 10)

  //   await mineBlock(provider, blockTimestamp + 20)
  //   await pair.sync(overrides)

  //   const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2))
  //   expect(await pair.price0CumulativeLast()).to.eq(initialPrice[0].mul(10).add(newPrice[0].mul(10)))
  //   expect(await pair.price1CumulativeLast()).to.eq(initialPrice[1].mul(10).add(newPrice[1].mul(10)))
  //   expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 20)
  // })

  // it('feeTo:off', async () => {
  //   const token0Amount = expandTo18Decimals(1000)
  //   const token1Amount = expandTo18Decimals(1000)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const swapAmount = expandTo18Decimals(1)
  //   const expectedOutputAmount = bigNumberify('996006981039903216')
  //   await token1.transfer(pair.address, swapAmount)
  //   await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

  //   const expectedLiquidity = expandTo18Decimals(1000)
  //   await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  //   await pair.burn(wallet.address, overrides)
  //   expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  // })

  // it('feeTo:on', async () => {
  //   await factory.setFeeTo(other.address)

  //   const token0Amount = expandTo18Decimals(1000)
  //   const token1Amount = expandTo18Decimals(1000)
  //   await addLiquidity(token0Amount, token1Amount)

  //   const swapAmount = expandTo18Decimals(1)
  //   const expectedOutputAmount = bigNumberify('996006981039903216')
  //   await token1.transfer(pair.address, swapAmount)
  //   await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

  //   const expectedLiquidity = expandTo18Decimals(1000)
  //   await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  //   await pair.burn(wallet.address, overrides)
  //   expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY.add('249750499251388'))
  //   expect(await pair.balanceOf(other.address)).to.eq('249750499251388')

  //   // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
  //   // ...because the initial liquidity amounts were equal
  //   expect(await token0.balanceOf(pair.address)).to.eq(bigNumberify(1000).add('249501683697445'))
  //   expect(await token1.balanceOf(pair.address)).to.eq(bigNumberify(1000).add('250000187312969'))
  // })
})
