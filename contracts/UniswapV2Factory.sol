// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import './interfaces/IUniswapV2Factory.sol';
import './UniswapV2Pair.sol';

/**
 * @title UniswapV2Factory
 * @author Uniswap
 * @notice 이 컨트랙은 UniswapV2Pair 컨트랙의 팩토리입니다.
 * @dev 이 컨트랙은 토큰 쌍을 생성하고 토큰 쌍을 가져오는 데 사용됩니다.
 */
contract UniswapV2Factory is IUniswapV2Factory {
    /// @dev {변수} 수수료 수령자
    address public feeTo;

    /// @dev {변수} 수수료 수령자 설정자
    address public feeToSetter;

    /// @dev {변수} 토큰 쌍
    mapping(address => mapping(address => address)) public getPair;

    /// @dev {변수} 모든 토큰 쌍
    address[] public allPairs;

    /// @dev {이벤트} 토큰 쌍 생성 이벤트
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    /**
     * @notice 생성자로 수수료 수령자 설정
     * @param _feeToSetter 수수료 수령자 설정자
     * @dev 아마도 수수료 발생 시 수수료를 소각하는게 아닌 수령자에게 전달하기 위한 용도 같음
     */
    constructor(address _feeToSetter) public {
        feeToSetter = _feeToSetter;
    }

    /**
     * @notice 모든 토큰 쌍 길이 조회
     * @dev 모든 토큰 쌍 길이를 조회합니다.
     */
    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    /**
     * @notice 토큰 쌍 생성
     * @dev 토큰 쌍을 생성합니다.
     * @param tokenA 토큰 A
     * @param tokenB 토큰 B
     * @return pair 토큰 쌍
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        /// @dev 토큰 A와 토큰 B가 같은 주소인 경우 예외 처리
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');

        /// @dev 토큰 A와 토큰 B 중 작은 주소를 token0, 큰 주소를 token1로 설정
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        /// @dev 토큰 A와 토큰 B가 0 주소인 경우 예외 처리
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');

        /// @dev 토큰 A와 토큰 B의 쌍이 이미 존재하는 경우 예외 처리
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient

        /// @dev UniswapV2Pair 컨트랙 생성 코드 가져오기 (컨트랙트 배포 바이트코드)
        bytes memory bytecode = type(UniswapV2Pair).creationCode;

        /// @dev 솔리디티 배포 코드 생성 (고유한 솔트 생성)
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));

        /// @dev 솔리디티 배포 코드 생성 (create2 사용)
        assembly {
            // 생성자에게 보낼 이더 양 = 0
            // 솔리디티 배포 코드 시작 주소 = bytecode 주소 + 32 (솔리디티 배포 코드 시작 주소 건너뛰기)
            // 솔리디티 배포 코드 길이 = bytecode 길이
            // 솔리디티 배포 코드 솔트 = token0, token1
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        /// @dev UniswapV2Pair 컨트랙 초기화
        IUniswapV2Pair(pair).initialize(token0, token1);

        /// @dev 토큰 쌍 매핑
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);

        /// @dev 이벤트 발생
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, 'UniswapV2: FORBIDDEN');
        feeToSetter = _feeToSetter;
    }
}
