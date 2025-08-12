// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

// a library for performing overflow-safe math, courtesy of DappHub (https://github.com/dapphub/ds-math)

import 'hardhat/console.sol';

library SafeMath {
    /**
     * @notice 덧셈 계산
     * @dev 덧셈 계산
     * @param x 덧셈 계산할 값
     * @param y 덧셈 계산할 값
     * @return z 덧셈 계산 결과
     */
    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'ds-math-add-overflow');
    }

    /**
     * @notice 뺄셈 계산
     * @dev 뺄셈 계산
     * @param x 뺄셈 계산할 값
     * @param y 뺄셈 계산할 값
     * @return z 뺄셈 계산 결과
     */
    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'ds-math-sub-underflow');
    }

    /**
     * @notice 곱셈 계산
     * @dev 곱셈 계산
     * @param x 곱셈 계산할 값
     * @param y 곱셈 계산할 값
     * @return z 곱셈 계산 결과
     */
    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
    }
}
