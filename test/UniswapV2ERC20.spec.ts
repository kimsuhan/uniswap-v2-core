import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { hexlify, keccak256, MaxUint256, Signature, toUtf8Bytes } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20 } from '../typechain-types'

const TOTAL_SUPPLY = BigInt(10000 * 10 ** 18)
const TEST_AMOUNT = BigInt(10 * 10 ** 18)
const tokenName = 'Uniswap V2'

// 컨트랙트 배포 후 waitForDeployment()를 호출하지 않았기 때문이었습니다. Ethers.js v6에서는 컨트랙트가 완전히 배포될 때까지 기다려야 함수 호출이 가능합니다. await token.waitForDeployment() 추가 후 심볼이 정상적으로 "UNI-V2"로 반환됩니다.
async function deployToken() {
  const erc20Token = await ethers.getContractFactory('ERC20')
  const token = await erc20Token.deploy(TOTAL_SUPPLY)
  await token.waitForDeployment()
  return { token }
}

describe('UniswapV2ERC20', () => {
  let token: ERC20
  let owner: HardhatEthersSigner
  let other: HardhatEthersSigner

  beforeEach(async () => {
    // 여기서 async 사용
    ;[owner, other] = await ethers.getSigners()
    const fixture = await loadFixture(deployToken)
    token = fixture.token
  })

  it('이름 확인', async () => {
    const name = await token.name()
    expect(name).to.equal(tokenName)
  })

  it('심볼 확인', async () => {
    const symbol = await token.symbol()
    expect(symbol).to.equal('UNI-V2')
  })

  it('소수점 자리수 확인', async () => {
    const decimals = await token.decimals()
    expect(decimals).to.equal(18)
  })

  it('총 발행량 확인', async () => {
    const totalSupply = await token.totalSupply()
    expect(totalSupply).to.equal(TOTAL_SUPPLY)
  })

  it('소유자 주소의 토큰 잔액 확인', async () => {
    const balance = await token.balanceOf(owner.address)
    expect(balance).to.equal(TOTAL_SUPPLY)
  })

  it('DOMAIN_SEPARATOR 확인', async () => {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    const network = await ethers.provider.getNetwork()
    const chainId = network.chainId

    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      // DOMAIN_SEPARATOR 확인 (EIP712 표준 적용)
      keccak256(
        abiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
            ),
            keccak256(toUtf8Bytes(tokenName)),
            keccak256(toUtf8Bytes('1')),
            chainId,
            await token.getAddress(),
          ]
        )
      )
    )
  })

  it('PERMIT_TYPEHASH 확인', async () => {
    const permitTypeHash = await token.PERMIT_TYPEHASH()
    expect(permitTypeHash).to.equal(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
    )
  })

  it('토큰 승인', async () => {
    const tx = await token.connect(owner).approve(other.address, TEST_AMOUNT)
    await tx.wait()

    await expect(tx).to.emit(token, 'Approval').withArgs(owner.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(owner.address, other.address)).to.eq(TEST_AMOUNT)
  })

  it('토큰 전송', async () => {
    const tx = await token.connect(owner).transfer(other.address, TEST_AMOUNT)
    await tx.wait()

    await expect(tx).to.emit(token, 'Transfer').withArgs(owner.address, other.address, TEST_AMOUNT)

    expect(await token.balanceOf(owner.address)).to.eq(BigInt(TOTAL_SUPPLY - TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('전송 실패', async () => {
    await expect(token.transfer(other.address, TOTAL_SUPPLY + BigInt(1))).to.be.reverted // ds-math-sub-underflow
    await expect(token.connect(other).transfer(owner.address, 1)).to.be.reverted // ds-math-sub-underflow
  })

  it('토큰 전송', async () => {
    await token.approve(other.address, TEST_AMOUNT)
    const tx = await token.connect(other).transferFrom(owner.address, other.address, TEST_AMOUNT)
    await tx.wait()

    await expect(tx).to.emit(token, 'Transfer').withArgs(owner.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(owner.address, other.address)).to.eq(0)
    expect(await token.balanceOf(owner.address)).to.eq(BigInt(TOTAL_SUPPLY - TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('토큰 전송 최대', async () => {
    await token.approve(other.address, MaxUint256)
    const tx = await token.connect(other).transferFrom(owner.address, other.address, TEST_AMOUNT)
    await tx.wait()

    await expect(tx).to.emit(token, 'Transfer').withArgs(owner.address, other.address, TEST_AMOUNT)

    expect(await token.allowance(owner.address, other.address)).to.eq(MaxUint256)
    expect(await token.balanceOf(owner.address)).to.eq(BigInt(TOTAL_SUPPLY - TEST_AMOUNT))
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  })

  it('EIP-2612 Permit 함수 테스트', async () => {
    // permit은 서명을 통해 가스비 없이 토큰 승인을 할 수 있게 해주는 기능
    // 사용자가 직접 트랜잭션을 보내지 않고도 제3자가 대신 승인 처리 가능

    // 1. nonce 가져오기 - 재생 공격(replay attack) 방지를 위한 일회성 번호
    const nonce = await token.nonces(owner.address)

    // 2. deadline 설정 - 서명이 유효한 기한 (MaxUint256 = 무제한)
    const deadline = MaxUint256

    // 4. EIP-712 서명 생성 - 사용자가 오프체인에서 승인 의사를 서명으로 표현
    const signature = await owner.signTypedData(
      // Domain Separator: 컨트랙트와 체인을 식별
      {
        name: tokenName, // 토큰 이름
        version: '1', // 서명 버전
        chainId: (await ethers.provider.getNetwork()).chainId, // 체인 ID
        verifyingContract: await token.getAddress(), // 컨트랙트 주소
      },
      // 타입 정의: 서명할 데이터 구조
      {
        Permit: [
          { name: 'owner', type: 'address' }, // 토큰 소유자
          { name: 'spender', type: 'address' }, // 승인받을 주소
          { name: 'value', type: 'uint256' }, // 승인할 토큰 양
          { name: 'nonce', type: 'uint256' }, // 재생공격 방지용 번호
          { name: 'deadline', type: 'uint256' }, // 서명 유효기한
        ],
      },
      // 실제 서명할 데이터
      {
        owner: owner.address,
        spender: other.address,
        value: TEST_AMOUNT,
        nonce: nonce,
        deadline: deadline,
      }
    )

    // 5. 서명을 v, r, s 형태로 분리
    // 이더리움의 ECDSA 서명은 v(복구ID), r(서명값1), s(서명값2)로 구성
    const { v, r, s } = Signature.from(signature)

    // 6. permit 함수 호출 - 서명을 통해 승인 실행
    // 가스비는 트랜잭션을 보내는 사람이 지불 (여기서는 테스트 계정)
    const tx = await token.permit(owner.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s))
    await tx.wait()

    // 7. 승인이 정상적으로 처리되었는지 확인
    await expect(tx).to.emit(token, 'Approval').withArgs(owner.address, other.address, TEST_AMOUNT)

    // 8. 승인 잔액과 nonce 증가 확인
    expect(await token.allowance(owner.address, other.address)).to.eq(TEST_AMOUNT)
    expect(await token.nonces(owner.address)).to.eq(1n) // nonce가 1 증가
  })
})
