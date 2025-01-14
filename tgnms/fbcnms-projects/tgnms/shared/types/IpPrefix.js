/**
 * Copyright (c) 2014-present, Facebook, Inc.
 */
// @flow strict-local

// Generated by thrift2flow at Thu Feb 21 2019 13:01:24 GMT-0800 (PST)
/* eslint-disable */

export type fbbinaryType = Buffer;

export type AddressTypeType = "VUNSPEC" | "V4" | "V6";
export const AddressTypeValueMap = {
  VUNSPEC: 0,
  V4: 1,
  V6: 2
};

export type AddressType = {|
  addr: string,
  type: AddressTypeType,
  port?: Buffer
|};

export type BinaryAddressType = {|
  addr: fbbinaryType,
  port?: Buffer,
  ifName?: string
|};

export type IpPrefixType = {|
  prefixAddress: BinaryAddressType,
  prefixLength: number
|};

export type UnicastRouteType = {|
  dest: IpPrefixType,
  nexthops: BinaryAddressType[]
|};
