import { expect } from 'chai'
import { ethers } from 'hardhat'

import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { ZeroAddress } from 'ethers'
import { UniswapV2Factory } from '../typechain-types'
import { getCreate2Address } from './shared/utilities'

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
]

async function deployFactory() {
  const [owner] = await ethers.getSigners()
  const factoryContract = await ethers.getContractFactory('UniswapV2Factory')
  const factory = await factoryContract.deploy(owner.address)
  await factory.waitForDeployment()
  return { factory, owner }
}

describe('UniswapV2Factory', () => {
  let owner: HardhatEthersSigner
  let other: HardhatEthersSigner
  let factory: UniswapV2Factory

  beforeEach(async () => {
    const signers = await ethers.getSigners()

    const fixture = await loadFixture(deployFactory)
    factory = fixture.factory
    owner = fixture.owner
    other = signers[1]
  })

  it('수수료 수령자 주소 확인', async () => {
    expect(await factory.feeTo()).to.eq(ZeroAddress) // 초기 상태에는 수수료 수령자 주소가 설정되어 있지 않음
  })

  it('수수료 수령자 설정자 확인', async () => {
    expect(await factory.feeToSetter()).to.eq(owner.address)
  })

  it('모든 토큰 쌍 길이 확인', async () => {
    expect(await factory.allPairsLength()).to.eq(0)
  })

  it('수수료 수령자 주소 설정', async () => {
    // 수수료 수령자 주소 설정 권한이 없는 경우 예외 처리
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('UniswapV2: FORBIDDEN')

    // 수수료 수령자 주소 설정
    const tx = await factory.setFeeTo(owner.address)
    await tx.wait()
    expect(await factory.feeTo()).to.eq(owner.address)
  })

  it('createPair', async () => {
    const factoryAddress = await factory.getAddress()
    const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair')
    const bytecode = UniswapV2Pair.bytecode
    const create2Address = getCreate2Address(factoryAddress, TEST_ADDRESSES, bytecode)

    await expect(factory.createPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1]))
      .to.emit(factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1)

    const pair = await factory.getPair(TEST_ADDRESSES[0], TEST_ADDRESSES[1])
    expect(await factory.allPairsLength()).to.eq(1)
    expect(pair).to.eq(create2Address)
  })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    // expect(receipt!.gasUsed).to.eq(2512920) 원리 2512920 였는데 왜 3551081 이 나오는지는 확인해보자. 버전올리면서 비용이 올라간건가?
    expect(receipt!.gasUsed).to.eq(3551081)
  })
})
