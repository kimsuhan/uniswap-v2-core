# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Uniswap V2 Core protocol implementation, containing the core smart contracts for the decentralized exchange. The project has been modernized from the original Waffle/Mocha setup to use Hardhat with TypeScript.

## Core Architecture

### Smart Contracts Structure
- **UniswapV2Factory**: Factory contract that creates new token pair contracts
- **UniswapV2Pair**: Core AMM logic for token swaps and liquidity provision
- **UniswapV2ERC20**: Base ERC20 implementation with EIP-2612 permit functionality

### Key Features
- **Automated Market Maker (AMM)**: Constant product formula (x * y = k)
- **EIP-2612 Permit**: Gasless token approvals via cryptographic signatures
- **Flash Swaps**: Borrow tokens temporarily within a single transaction
- **Price Oracle**: Cumulative price tracking for external price feeds

## Development Commands

### Testing
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/UniswapV2ERC20.spec.ts

# Run specific test by name
npx hardhat test --grep "permit"
```

### Compilation
```bash
# Compile contracts
npx hardhat compile

# Clean build artifacts
npx hardhat clean
```

### Linting
```bash
# Check formatting
yarn lint

# Fix formatting issues
yarn lint:fix
```

## Important Implementation Details

### EIP-712 Signatures
When working with permit functionality, always use `signTypedData()` for EIP-712 structured data signatures, not `signMessage()` for personal message signatures. The permit function requires proper domain separation and structured data format.

### Contract Deployment
In Hardhat/Ethers v6, always call `waitForDeployment()` after contract deployment before interacting with the contract.

### Korean Language Support
This codebase includes Korean comments and test descriptions. When adding new tests or documentation, follow the existing bilingual pattern.

## Test Architecture

Tests use Hardhat's testing framework with:
- **Fixtures**: `loadFixture()` for consistent test state
- **Chai matchers**: Extended matchers for Ethereum-specific assertions
- **TypeChain**: Auto-generated TypeScript bindings for contracts

## File Structure Context

- `contracts/`: Core Solidity contracts and interfaces
- `test/`: Hardhat test files (현재 활성)
- `test-bak/`: Legacy test files (백업)
- `typechain-types/`: Auto-generated TypeScript contract interfaces
- `artifacts/`: Compiled contract artifacts