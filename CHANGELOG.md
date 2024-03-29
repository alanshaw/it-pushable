## [3.2.3](https://github.com/alanshaw/it-pushable/compare/v3.2.2...v3.2.3) (2023-11-16)


### Bug Fixes

* support onEmpty with onEnd ([#76](https://github.com/alanshaw/it-pushable/issues/76)) ([26b5d18](https://github.com/alanshaw/it-pushable/commit/26b5d18d788b16833d66c4063a1c9f07d5a57e53))

## [3.2.2](https://github.com/alanshaw/it-pushable/compare/v3.2.1...v3.2.2) (2023-11-11)


### Trivial Changes

* add or force update .github/workflows/js-test-and-release.yml ([#66](https://github.com/alanshaw/it-pushable/issues/66)) ([9dc3452](https://github.com/alanshaw/it-pushable/commit/9dc3452fb1d6dc7a978dec2b429204996e28eb3a))
* delete templates [skip ci] ([#65](https://github.com/alanshaw/it-pushable/issues/65)) ([623e049](https://github.com/alanshaw/it-pushable/commit/623e0496897df1db83c5677c3540b5b708251372))


### Dependencies

* **dev:** bump aegir from 39.0.13 to 41.0.5 ([#74](https://github.com/alanshaw/it-pushable/issues/74)) ([ca99910](https://github.com/alanshaw/it-pushable/commit/ca9991015a1852c2aedc16af149237ff5c083742))

## [3.2.1](https://github.com/alanshaw/it-pushable/compare/v3.2.0...v3.2.1) (2023-07-04)


### Bug Fixes

* await returned promise in waitNext ([#59](https://github.com/alanshaw/it-pushable/issues/59)) ([d19e8ca](https://github.com/alanshaw/it-pushable/commit/d19e8caf02a98989bd4c42f60ccc8d616bdbe12b))

## [3.2.0](https://github.com/alanshaw/it-pushable/compare/v3.1.4...v3.2.0) (2023-07-03)


### Features

* add onEmpty function that resolves when the queue is empty ([#58](https://github.com/alanshaw/it-pushable/issues/58)) ([2bed38a](https://github.com/alanshaw/it-pushable/commit/2bed38ad1e477efc30c1a800c4de51813c8319d0))

## [3.1.4](https://github.com/alanshaw/it-pushable/compare/v3.1.3...v3.1.4) (2023-06-30)


### Dependencies

* **dev:** bump aegir from 37.12.1 to 39.0.13 ([#52](https://github.com/alanshaw/it-pushable/issues/52)) ([9399579](https://github.com/alanshaw/it-pushable/commit/939957932ed19a6558748e06ce50822b8d062b9b))

## [3.1.3](https://github.com/alanshaw/it-pushable/compare/v3.1.2...v3.1.3) (2023-04-18)


### Bug Fixes

* extend async generator ([#56](https://github.com/alanshaw/it-pushable/issues/56)) ([3cf8f5c](https://github.com/alanshaw/it-pushable/commit/3cf8f5c5dd6d7aac8e93f7bfe003b99caf9267ca))

## [3.1.2](https://github.com/alanshaw/it-pushable/compare/v3.1.1...v3.1.2) (2022-12-16)


### Documentation

* publish api docs ([#39](https://github.com/alanshaw/it-pushable/issues/39)) ([95adf08](https://github.com/alanshaw/it-pushable/commit/95adf08e789b8ca4617163026e091835aba39706))

## [3.1.1](https://github.com/alanshaw/it-pushable/compare/v3.1.0...v3.1.1) (2022-12-16)


### Trivial Changes

* **deps-dev:** bump it-all from 1.0.6 to 2.0.0 ([#34](https://github.com/alanshaw/it-pushable/issues/34)) ([1b50e5e](https://github.com/alanshaw/it-pushable/commit/1b50e5ed9211711530103db140cd401ecb2339fd))

## [3.1.0](https://github.com/alanshaw/it-pushable/compare/v3.0.0...v3.1.0) (2022-08-02)


### Features

* support Uint8ArrayLists in the same way as Uint8Arrays ([#30](https://github.com/alanshaw/it-pushable/issues/30)) ([7bae368](https://github.com/alanshaw/it-pushable/commit/7bae3688b1363954539b56de79c3a81ff53df59f))

## [3.0.0](https://github.com/alanshaw/it-pushable/compare/v2.0.2...v3.0.0) (2022-06-10)


### ⚠ BREAKING CHANGES

* `Uint8Array`s are expected by default, pass `objectMode: true` to push any other data types. If using TypeScript, use generics to define the data type.

### Features

* add readableLength property ([#27](https://github.com/alanshaw/it-pushable/issues/27)) ([f45aee3](https://github.com/alanshaw/it-pushable/commit/f45aee36e72e754b8a27dda48d3051c470aaa8e5))


### Trivial Changes

* fix flaky test ([#28](https://github.com/alanshaw/it-pushable/issues/28)) ([8c3dcc1](https://github.com/alanshaw/it-pushable/commit/8c3dcc1f8e64f2877317a835bb03545f7fa2dd53))

### [2.0.2](https://github.com/alanshaw/it-pushable/compare/v2.0.1...v2.0.2) (2022-06-08)


### Bug Fixes

* update aegir ([#24](https://github.com/alanshaw/it-pushable/issues/24)) ([9c1a478](https://github.com/alanshaw/it-pushable/commit/9c1a4783a536d90bcede5d29cc2d66d2a0d5321a))


### Trivial Changes

* update publish command ([#25](https://github.com/alanshaw/it-pushable/issues/25)) ([b82173f](https://github.com/alanshaw/it-pushable/commit/b82173f3c7d07581e1ece3ed3026ccbbf6c57056))

### [2.0.1](https://github.com/alanshaw/it-pushable/compare/v2.0.0...v2.0.1) (2022-01-13)


### Trivial Changes

* fix readme example ([#13](https://github.com/alanshaw/it-pushable/issues/13)) ([d4d7282](https://github.com/alanshaw/it-pushable/commit/d4d728275ba97977fd2004be749a57bbb74aebca))

## [2.0.0](https://github.com/alanshaw/it-pushable/compare/v1.4.2...v2.0.0) (2022-01-13)


### ⚠ BREAKING CHANGES

* switch to named exports, ESM only

### Features

* convert to typescript ([#12](https://github.com/alanshaw/it-pushable/issues/12)) ([49e0805](https://github.com/alanshaw/it-pushable/commit/49e080564a410a5f3475dfaa389ad8f0f1d8582c))
