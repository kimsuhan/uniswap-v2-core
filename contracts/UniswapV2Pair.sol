// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import './interfaces/IUniswapV2Pair.sol';
import './UniswapV2ERC20.sol';
import './libraries/Math.sol';
import './libraries/UQ112x112.sol';
import './interfaces/IERC20.sol';
import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Callee.sol';

contract UniswapV2Pair is IUniswapV2Pair, UniswapV2ERC20 {
    using SafeMath for uint;
    using UQ112x112 for uint224;

    /// @dev {변수} 최소 유동성 = 1000
    uint public constant MINIMUM_LIQUIDITY = 10 ** 3;

    /// @dev {변수} 토큰 전송 함수 셀렉터
    bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

    /// @dev {변수} 팩토리 주소
    address public factory;

    /// @dev {변수} 토큰 0
    address public token0;

    /// @dev {변수} 토큰 1
    address public token1;

    /// @dev {변수} 토큰 0 예약
    uint112 private reserve0; // 단일 저장 슬롯을 사용하며, getReserves를 통해 액세스 가능합니다.

    /// @dev {변수} 토큰 1 예약
    uint112 private reserve1; // 단일 저장 슬롯을 사용하며, getReserves를 통해 액세스 가능합니다.

    /// @dev {변수} 블록 타임스탬프 마지막
    uint32 private blockTimestampLast; // 단일 저장 슬롯을 사용하며, getReserves를 통해 액세스 가능합니다.

    /// @dev {변수} 토큰 0 누적 가격
    uint public price0CumulativeLast;

    /// @dev {변수} 토큰 1 누적 가격
    uint public price1CumulativeLast;

    ///
    uint public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    /// @dev {변수} 컨트랙 잠금 상태
    uint private unlocked = 1;

    /**
     * @notice 컨트랙이 잠겨있는지 아닌지 확인하는 modifier
     * @dev 들어와서 잠겨있지 않다면 잠금 상태로 변경하고 함수 실행 후 다시 잠금 해제 (아마 중복 실행 방지를 위해 사용되지 않을까 싶다)
     */
    modifier lock() {
        require(unlocked == 1, 'UniswapV2: LOCKED');
        unlocked = 0;
        _; // 함수 실행 후 다시 잠금 상태로 변경
        unlocked = 1;
    }

    /**
     * @notice 토큰 0 예약과 토큰 1 예약 및 블록 타임스탬프 마지막 조회
     * @dev 아.. 컨트랙에 있는 private 상태값들을 조회하는 용도임
     * @return _reserve0 토큰 0 예약
     * @return _reserve1 토큰 1 예약
     * @return _blockTimestampLast 블록 타임스탬프 마지막
     */
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /// ?
    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'UniswapV2: TRANSFER_FAILED');
    }

    /// @dev {이벤트} 민팅?
    event Mint(address indexed sender, uint amount0, uint amount1);

    /// @dev {이벤트} 소각일거고
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);

    /// @dev {이벤트} 스왑
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );

    /// @dev {이벤트} 동기화?
    event Sync(uint112 reserve0, uint112 reserve1);

    /**
     * @notice 생성자
     * @dev 팩토리 주소를 설정 (팩토리 패턴에 의해서 컨트랙에서 배포되기때문에 msg.sender는 팩토리 주소가 됨)
     */
    constructor() public {
        factory = msg.sender;
    }

    /**
     * @notice 초기화
     * @dev 팩토리에 의해 배포되면서 처음 초기화 함수를 호출함. 초기화 하면서 token0와 token1 주소를 설정함
     * @param _token0 토큰 0
     * @param _token1 토큰 1
     */
    function initialize(address _token0, address _token1) external {
        require(msg.sender == factory, 'UniswapV2: FORBIDDEN'); // sufficient check (팩토리 주소와 현재 컨트랙 주소가 같은지 확인)
        token0 = _token0;
        token1 = _token1;
    }

    // update reserves and, on the first call per block, price accumulators
    function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
        require(balance0 <= uint112(-1) && balance1 <= uint112(-1), 'UniswapV2: OVERFLOW');
        uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            // * never overflows, and + overflow is desired
            price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
            price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
        }
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        emit Sync(reserve0, reserve1);
    }

    // if fee is on, mint liquidity equivalent to 1/6th of the growth in sqrt(k)
    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        // 팩토리에서 수수료 수령자의 주소를 조회
        address feeTo = IUniswapV2Factory(factory).feeTo();

        // 수수료 수령자의 주소가 0 주소가 아닌지 확인
        feeOn = feeTo != address(0);

        uint _kLast = kLast; // gas savings

        // 수수료 수령자의 주소가 0 주소가 아니라면 수수료 켜진 상태
        if (feeOn) {
            // 마지막 유동성 풀 값이 0이 아니라면 수수료 켜진 상태
            if (_kLast != 0) {
                // 토큰 0 예약 * 토큰 1 예약의 제곱근
                uint rootK = Math.sqrt(uint(_reserve0).mul(_reserve1));

                // 마지막 유동성 풀 값의 제곱근
                uint rootKLast = Math.sqrt(_kLast);

                // 토큰 0 예약 * 토큰 1 예약의 제곱근이 마지막 유동성 풀 값의 제곱근보다 크다면 수수료 켜진 상태
                if (rootK > rootKLast) {
                    // 토큰 0 예약 * 토큰 1 예약의 제곱근 - 마지막 유동성 풀 값의 제곱근
                    uint numerator = totalSupply.mul(rootK.sub(rootKLast));

                    // 토큰 0 예약 * 토큰 1 예약의 제곱근 * 5 + 마지막 유동성 풀 값의 제곱근
                    uint denominator = rootK.mul(5).add(rootKLast);

                    // 토큰 0 예약 * 토큰 1 예약의 제곱근 - 마지막 유동성 풀 값의 제곱근 / 토큰 0 예약 * 토큰 1 예약의 제곱근 * 5 + 마지막 유동성 풀 값의 제곱근
                    uint liquidity = numerator / denominator;

                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    // this low-level function should be called from a contract which performs important safety checks
    /**
     * @notice 유동성 민팅
     * @dev 이 함수는 직접 호출하지 말고, 반드시 검증 로직이 있는 상위 컨트랙트에서만 호출해야 함. (라우터 컨트랙트에서 호출함)
     * @param to 민팅 받는 주소
     * @return liquidity 민팅된 유동성 (민팅 받는 주소에게 민팅된 유동성을 반환함)
     */
    function mint(address to) external lock returns (uint liquidity) {
        // _reserve0, _reserve1 값을 미리 변수에 저장함으로써, 이후 코드에서 여러 번 getReserves()를 호출하지 않고 변수만 참조하므로 gas를 절약할 수 있음(메모리 접근이 함수 호출보다 저렴함)
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves();

        // 현재 컨트랙에 있는 토큰 0 잔액
        uint balance0 = IERC20(token0).balanceOf(address(this));

        // 현재 컨트랙에 있는 토큰 1 잔액
        uint balance1 = IERC20(token1).balanceOf(address(this));

        // 토큰 0 잔액 - 토큰 0 예약 = 토큰 0 스왑 잔액
        uint amount0 = balance0.sub(_reserve0);

        // 토큰 1 잔액 - 토큰 1 예약 = 토큰 1 스왑 잔액
        uint amount1 = balance1.sub(_reserve1);

        // TODO 일단 나중에 체크해보자
        bool feeOn = _mintFee(_reserve0, _reserve1);

        // 토큰 총 공급량 (가스비 절약을 위해 미리 변수에 저장함)
        uint _totalSupply = totalSupply; // 가스 절감 효과는 여기에서 정의되어야 합니다. 왜냐하면 totalSupply는 _mintFee에서 업데이트될 수 있기 때문입니다.

        // 토큰 총 공급량이 0이라면 최소 유동성 풀 값을 민팅
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
        } else {
            liquidity = Math.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
        }

        // 유동성이 0보다 큰지 확인
        require(liquidity > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_MINTED');

        // 민팅 받는 주소에 유동성 민팅
        _mint(to, liquidity);

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0).mul(reserve1); // reserve0 and reserve1 are up-to-date
        emit Mint(msg.sender, amount0, amount1);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function burn(address to) external lock returns (uint amount0, uint amount1) {
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        uint balance0 = IERC20(_token0).balanceOf(address(this));
        uint balance1 = IERC20(_token1).balanceOf(address(this));
        uint liquidity = balanceOf[address(this)];

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        amount0 = liquidity.mul(balance0) / _totalSupply; // using balances ensures pro-rata distribution
        amount1 = liquidity.mul(balance1) / _totalSupply; // using balances ensures pro-rata distribution
        require(amount0 > 0 && amount1 > 0, 'UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED');
        _burn(address(this), liquidity);
        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1, _reserve0, _reserve1);
        if (feeOn) kLast = uint(reserve0).mul(reserve1); // reserve0 and reserve1 are up-to-date
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // this low-level function should be called from a contract which performs important safety checks
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            address _token0 = token0;
            address _token1 = token1;
            require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');
            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
            if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');
        {
            // scope for reserve{0,1}Adjusted, avoids stack too deep errors
            uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
            uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
            require(
                balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(1000 ** 2),
                'UniswapV2: K'
            );
        }

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    // force balances to match reserves
    function skim(address to) external lock {
        address _token0 = token0; // gas savings
        address _token1 = token1; // gas savings
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)).sub(reserve0));
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)).sub(reserve1));
    }

    // force reserves to match balances
    function sync() external lock {
        _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)), reserve0, reserve1);
    }
}
