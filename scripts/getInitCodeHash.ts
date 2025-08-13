import { ethers } from 'hardhat'

async function main() {
  try {
    // 1. 컨트랙트 팩토리 가져오기
    console.log('1. UniswapV2Pair 컨트랙트 로딩...')
    const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair')

    // 2. Bytecode 정보
    console.log('2. Bytecode 길이:', UniswapV2Pair.bytecode.length)
    console.log('3. Bytecode 일부:', UniswapV2Pair.bytecode.slice(0, 50) + '...')

    // 3. Init code hash 계산
    console.log('4. Init Code Hash 계산 중...')
    const initCodeHash = ethers.keccak256(UniswapV2Pair.bytecode)

    // 4. 결과 출력
    console.log('\n=== 결과 ===')
    console.log('Full Hash:', initCodeHash)
    console.log('Solidity 형태:', `hex'${initCodeHash.slice(2)}'`)

    // 5. 검증용 정보
    console.log('\n=== 검증 정보 ===')
    // console.log('네트워크:', hre.network.name)
    console.log('Solidity 버전:', '확인 필요') // hardhat.config.js에서 확인
  } catch (error) {
    console.error('에러 발생:', error)
  }
}

// 에러 처리
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
