// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

// a library for handling binary fixed point numbers (https://en.wikipedia.org/wiki/Q_(number_format))

// range: [0, 2**112 - 1]
// resolution: 1 / 2**112

library UQ112x112 {
    uint224 constant Q112 = 2 ** 112; // 2의 112승

    /**
     * @notice 112비트 정수를 112비트 고정 소수로 변환
     * @dev 112비트 정수를 112비트 고정 소수로 변환
     * @param y 112비트 정수
     * @return z 112비트 고정 소수
     */
    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112; // 오버플로우 방지
    }

    /**
     * @notice 112비트 고정 소수를 112비트 정수로 나누기
     * @dev 112비트 고정 소수를 112비트 정수로 나누기
     * @param x 112비트 고정 소수
     * @param y 112비트 정수
     * @return z 112비트 고정 소수
     */
    function uqdiv(uint224 x, uint112 y) internal pure returns (uint224 z) {
        z = x / uint224(y);
    }
}
