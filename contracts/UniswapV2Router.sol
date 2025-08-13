// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import './interfaces/IUniswapV2Router.sol';
import './libraries/SafeMath.sol';
import './libraries/UniswapV2Library.sol';
import './libraries/TransferHelper.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWETH.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import 'hardhat/console.sol';

contract UniswapV2Router is IUniswapV2Router {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WETH;

    /**
     * @notice 생성자
     * @param _factory 팩토리 주소
     * @param _WETH WETH 주소
     */
    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'UniswapV2Router: EXPIRED');
        _;
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }

    /**
     * @notice 풀 추가
     * @param tokenA 풀에 집어넣을 토큰 A
     * @param tokenB 풀에 집어넣을 토큰 B
     * @param amountADesired 풀에 집어넣을 토큰 A의 양
     * @param amountBDesired 풀에 집어넣을 토큰 B의 양
     * @param amountAMin TODO 풀에 집어넣을 토큰 A의 최소 양
     * @param amountBMin TODO 풀에 집어넣을 토큰 B의 최소 양
     * @param to TODO 풀에 집어넣은 토큰을 받을 주소
     * @param deadline TODO 풀에 집어넣을 시간
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IUniswapV2Pair(pair).mint(to);
    }

    /**
     * @notice 토큰 추가 전에 검증 하는 함수
     * @param tokenA 풀에 집어넣을 토큰 A
     * @param tokenB 풀에 집어넣을 토큰 B
     * @param amountADesired 풀에 집어넣을 토큰 A의 양
     * @param amountBDesired 풀에 집어넣을 토큰 B의 양
     * @param amountAMin TODO 풀에 집어넣을 토큰 A의 최소 양
     * @param amountBMin TODO 풀에 집어넣을 토큰 B의 최소 양
     */
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        // 팩토리로 풀이 존재하는지 확인 후 없으면 생성
        if (IUniswapV2Factory(factory).getPair(tokenA, tokenB) == address(0)) {
            IUniswapV2Factory(factory).createPair(tokenA, tokenB);
        }

        // 풀의 잔고 확인
        (uint reserveA, uint reserveB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);

        // 풀의 잔고가 0이면 풀에 집어넣을 토큰 A와 B의 양을 풀에 집어넣을 토큰 A와 B의 양으로 설정
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        }
        // 풀의 잔고가 0이 아니면
        else {
            //
            uint amountBOptimal = UniswapV2Library.quote(amountADesired, reserveA, reserveB);

            // console.log('amountADesired', amountADesired);
            // console.log('reserveA', reserveA);
            // console.log('reserveB', reserveB);
            console.log('amountBDesired', amountBDesired);
            console.log('amountBOptimal', amountBOptimal);

            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = UniswapV2Library.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    // function addLiquidityETH(
    //     address token,
    //     uint amountTokenDesired,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline
    // ) external payable virtual override ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
    //     (amountToken, amountETH) = _addLiquidity(
    //         token,
    //         WETH,
    //         amountTokenDesired,
    //         msg.value,
    //         amountTokenMin,
    //         amountETHMin
    //     );
    //     address pair = UniswapV2Library.pairFor(factory, token, WETH);
    //     TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
    //     IWETH(WETH).deposit{value: amountETH}();
    //     assert(IWETH(WETH).transfer(pair, amountETH));
    //     liquidity = IUniswapV2Pair(pair).mint(to);
    //     // refund dust eth, if any
    //     if (msg.value > amountETH) TransferHelper.safeTransferETH(msg.sender, msg.value - amountETH);
    // }

    // // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB); // 풀 주소 조회
        IUniswapV2Pair(pair).transferFrom(msg.sender, pair, liquidity); // 유동성 토큰을 풀에 전송

        (uint amount0, uint amount1) = IUniswapV2Pair(pair).burn(to); // 풀에서 유동성 토큰을 소각
        (address token0, ) = UniswapV2Library.sortTokens(tokenA, tokenB); // 토큰 순서 정렬

        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'UniswapV2Router: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'UniswapV2Router: INSUFFICIENT_B_AMOUNT');
    }

    // function removeLiquidityETH(
    //     address token,
    //     uint liquidity,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline
    // ) public virtual override ensure(deadline) returns (uint amountToken, uint amountETH) {
    //     (amountToken, amountETH) = removeLiquidity(
    //         token,
    //         WETH,
    //         liquidity,
    //         amountTokenMin,
    //         amountETHMin,
    //         address(this),
    //         deadline
    //     );
    //     TransferHelper.safeTransfer(token, to, amountToken);
    //     IWETH(WETH).withdraw(amountETH);
    //     TransferHelper.safeTransferETH(to, amountETH);
    // }
    // function removeLiquidityWithPermit(
    //     address tokenA,
    //     address tokenB,
    //     uint liquidity,
    //     uint amountAMin,
    //     uint amountBMin,
    //     address to,
    //     uint deadline,
    //     bool approveMax,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) external virtual override returns (uint amountA, uint amountB) {
    //     address pair = UniswapV2Library.pairFor(factory, tokenA, tokenB);
    //     uint value = approveMax ? type(uint).max : liquidity;
    //     IUniswapV2Pair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
    //     (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    // }
    // function removeLiquidityETHWithPermit(
    //     address token,
    //     uint liquidity,
    //     uint amountTokenMin,
    //     uint amountETHMin,
    //     address to,
    //     uint deadline,
    //     bool approveMax,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) external virtual override returns (uint amountToken, uint amountETH) {
    //     address pair = UniswapV2Library.pairFor(factory, token, WETH);
    //     uint value = approveMax ? type(uint).max : liquidity;
    //     IUniswapV2Pair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
    //     (amountToken, amountETH) = removeLiquidityETH(token, liquidity, amountTokenMin, amountETHMin, to, deadline);
    // }

    // // **** SWAP ****
    // // requires the initial amount to have already been sent to the first pair
    // function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
    //     for (uint i; i < path.length - 1; i++) {
    //         (address input, address output) = (path[i], path[i + 1]);
    //         (address token0, ) = UniswapV2Library.sortTokens(input, output);
    //         uint amountOut = amounts[i + 1];
    //         (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
    //         address to = i < path.length - 2 ? UniswapV2Library.pairFor(factory, output, path[i + 2]) : _to;
    //         IUniswapV2Pair(UniswapV2Library.pairFor(factory, input, output)).swap(
    //             amount0Out,
    //             amount1Out,
    //             to,
    //             new bytes(0)
    //         );
    //     }
    // }
    // function swapExactTokensForTokens(
    //     uint amountIn,
    //     uint amountOutMin,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);
    //     require(amounts[amounts.length - 1] >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
    //     TransferHelper.safeTransferFrom(
    //         path[0],
    //         msg.sender,
    //         UniswapV2Library.pairFor(factory, path[0], path[1]),
    //         amounts[0]
    //     );
    //     _swap(amounts, path, to);
    // }
    // function swapTokensForExactTokens(
    //     uint amountOut,
    //     uint amountInMax,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);
    //     require(amounts[0] <= amountInMax, 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
    //     TransferHelper.safeTransferFrom(
    //         path[0],
    //         msg.sender,
    //         UniswapV2Library.pairFor(factory, path[0], path[1]),
    //         amounts[0]
    //     );
    //     _swap(amounts, path, to);
    // }
    // function swapExactETHForTokens(
    //     uint amountOutMin,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external payable virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     require(path[0] == WETH, 'UniswapV2Router: INVALID_PATH');
    //     amounts = UniswapV2Library.getAmountsOut(factory, msg.value, path);
    //     require(amounts[amounts.length - 1] >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
    //     IWETH(WETH).deposit{value: amounts[0]}();
    //     assert(IWETH(WETH).transfer(UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]));
    //     _swap(amounts, path, to);
    // }
    // function swapTokensForExactETH(
    //     uint amountOut,
    //     uint amountInMax,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     require(path[path.length - 1] == WETH, 'UniswapV2Router: INVALID_PATH');
    //     amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);
    //     require(amounts[0] <= amountInMax, 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
    //     TransferHelper.safeTransferFrom(
    //         path[0],
    //         msg.sender,
    //         UniswapV2Library.pairFor(factory, path[0], path[1]),
    //         amounts[0]
    //     );
    //     _swap(amounts, path, address(this));
    //     IWETH(WETH).withdraw(amounts[amounts.length - 1]);
    //     TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    // }
    // function swapExactTokensForETH(
    //     uint amountIn,
    //     uint amountOutMin,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     require(path[path.length - 1] == WETH, 'UniswapV2Router: INVALID_PATH');
    //     amounts = UniswapV2Library.getAmountsOut(factory, amountIn, path);
    //     require(amounts[amounts.length - 1] >= amountOutMin, 'UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');
    //     TransferHelper.safeTransferFrom(
    //         path[0],
    //         msg.sender,
    //         UniswapV2Library.pairFor(factory, path[0], path[1]),
    //         amounts[0]
    //     );
    //     _swap(amounts, path, address(this));
    //     IWETH(WETH).withdraw(amounts[amounts.length - 1]);
    //     TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    // }
    // function swapETHForExactTokens(
    //     uint amountOut,
    //     address[] calldata path,
    //     address to,
    //     uint deadline
    // ) external payable virtual override ensure(deadline) returns (uint[] memory amounts) {
    //     require(path[0] == WETH, 'UniswapV2Router: INVALID_PATH');
    //     amounts = UniswapV2Library.getAmountsIn(factory, amountOut, path);
    //     require(amounts[0] <= msg.value, 'UniswapV2Router: EXCESSIVE_INPUT_AMOUNT');
    //     IWETH(WETH).deposit{value: amounts[0]}();
    //     assert(IWETH(WETH).transfer(UniswapV2Library.pairFor(factory, path[0], path[1]), amounts[0]));
    //     _swap(amounts, path, to);
    //     // refund dust eth, if any
    //     if (msg.value > amounts[0]) TransferHelper.safeTransferETH(msg.sender, msg.value - amounts[0]);
    // }

    // // **** LIBRARY FUNCTIONS ****
    // function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB) {
    //     return UniswapV2Library.quote(amountA, reserveA, reserveB);
    // }

    // function getAmountOut(
    //     uint amountIn,
    //     uint reserveIn,
    //     uint reserveOut
    // ) public pure virtual override returns (uint amountOut) {
    //     return UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
    // }

    // function getAmountIn(
    //     uint amountOut,
    //     uint reserveIn,
    //     uint reserveOut
    // ) public pure virtual override returns (uint amountIn) {
    //     return UniswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut);
    // }

    // function getAmountsOut(
    //     uint amountIn,
    //     address[] memory path
    // ) public view virtual override returns (uint[] memory amounts) {
    //     return UniswapV2Library.getAmountsOut(factory, amountIn, path);
    // }

    // function getAmountsIn(
    //     uint amountOut,
    //     address[] memory path
    // ) public view virtual override returns (uint[] memory amounts) {
    //     return UniswapV2Library.getAmountsIn(factory, amountOut, path);
    // }
}
