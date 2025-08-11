// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

// a library for performing various math operations

library Math {
    /**
     * @notice 최소값 계산
     * @dev 최소값 계산
     * @param x 최소값 계산할 값
     * @param y 최소값 계산할 값
     * @return z 최소값 계산 결과
     */
    function min(uint x, uint y) internal pure returns (uint z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    /**
     * @notice 제곱근 계산
     * @dev 제곱근 계산
     * @param y 제곱근 계산할 값
     * @return z 제곱근 계산 결과
     */
    function sqrt(uint y) internal pure returns (uint z) {
        // y가 3보다 크면 제곱근 계산
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1; // 초기값 설정

            // x가 z보다 작을 때까지 반복
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
