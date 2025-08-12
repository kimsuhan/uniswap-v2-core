import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';

// import { expandTo18Decimals } from '../test-bak/shared/utilities';

const TOTAL_SUPPLY = BigInt(10000 * 10 ** 18);
const TEST_AMOUNT = BigInt(10 * 10 ** 18);

async function deployToken() {
  const erc20Token = await ethers.getContractFactory('ERC20');
  const token = await erc20Token.deploy(TOTAL_SUPPLY);
  return { token };
}


describe('UniswapV2ERC20', () => {
  let token: any;
  let owner: any;
  let other: any;

  beforeEach(async () => {  // 여기서 async 사용
    [owner, other] = await ethers.getSigners();
    const fixture = await loadFixture(deployToken);
    token = fixture.token;
  });

  // it('name', async () => {
  //   expect(await token.name()).to.eq('Uniswap V2')
  // })

  it('심볼 확인', async () => {
    const symbol = await token.symbol();
    console.log(symbol);
    // const code = await ethers.provider.getCode(token.symbol || token.address);
    // console.log(code);
    // const symbol = await token.symbol();
    // console.log('심볼 확인')
    // console.log(symbol);
    // console.log('aaa');
    // expect(symbol).to.eq('UNI-V3')
  })

  // it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
  
  //   const name = await token.name()
  //   expect(name).to.eq('Uniswap V2') // 토큰 이름이 맞는지 확인
  //   expect(await token.symbol()).to.eq('UNI-V3') // 토큰 심볼이 맞는지 확인
  //   expect(await token.decimals()).to.eq(18) // 토큰 소수점 자리수가 맞는지 확인
  //   expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY) // 토큰 총 발행량이 맞는지 확인
  //   expect(await token.balanceOf(owner.address)).to.eq(TOTAL_SUPPLY) // 소유자 주소의 토큰 잔액이 맞는지 확인

  //   const abiCoder = ethers.AbiCoder.defaultAbiCoder(); // ABI 인코더 생성

  //   expect(await token.DOMAIN_SEPARATOR()).to.eq( // DOMAIN_SEPARATOR 확인 (EIP712 표준 적용)
  //     keccak256(
  //       abiCoder.encode(
  //         ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
  //         [
  //           keccak256(
  //             toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
  //           ),
  //           keccak256(toUtf8Bytes(name)),
  //           keccak256(toUtf8Bytes('1')),
  //           1,
  //           await token.getAddress()
  //         ]
  //       )
  //     )
  //   )
  //   expect(await token.PERMIT_TYPEHASH()).to.eq( // PERMIT_TYPEHASH 확인 (EIP712 표준 적용)
  //     keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
  //   )
  // })


  // it('approve', async () => {
  //   await expect(token.approve(owner.address, TEST_AMOUNT)).to.emit(token, 'Approval').withArgs(owner.address, owner.address, TEST_AMOUNT)
  //   expect(await token.allowance(owner.address, owner.address)).to.eq(TEST_AMOUNT)
  // })

  // it('transfer', async () => {
  //   await expect(token.transfer(other.address, TEST_AMOUNT))
  //     .to.emit(token, 'Transfer')
  //     .withArgs(owner.address, other.address, TEST_AMOUNT)
    
  //   expect(await token.balanceOf(owner.address)).to.eq(BigInt(TOTAL_SUPPLY - TEST_AMOUNT - BigInt(10)))
  //   expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  // })

  // it('transfer:fail', async () => {
  //   await expect(token.transfer(other.address, TOTAL_SUPPLY.add(1))).to.be.reverted // ds-math-sub-underflow
  //   await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted // ds-math-sub-underflow
  // })

  // it('transferFrom', async () => {
  //   await token.approve(other.address, TEST_AMOUNT)
  //   await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
  //     .to.emit(token, 'Transfer')
  //     .withArgs(wallet.address, other.address, TEST_AMOUNT)
  //   expect(await token.allowance(wallet.address, other.address)).to.eq(0)
  //   expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
  //   expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  // })

  // it('transferFrom:max', async () => {
  //   await token.approve(other.address, MaxUint256)
  //   await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
  //     .to.emit(token, 'Transfer')
  //     .withArgs(wallet.address, other.address, TEST_AMOUNT)
  //   expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256)
  //   expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
  //   expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT)
  // })

  // it('permit', async () => {
  //   const nonce = await token.nonces(wallet.address)
  //   const deadline = MaxUint256
  //   const digest = await getApprovalDigest(
  //     token,
  //     { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
  //     nonce,
  //     deadline
  //   )

  //   const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

  //   await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)))
  //     .to.emit(token, 'Approval')
  //     .withArgs(wallet.address, other.address, TEST_AMOUNT)
  //   expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT)
  //   expect(await token.nonces(wallet.address)).to.eq(bigNumberify(1))
  // })
})

