/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow
 */

import {renderHook} from '@testing-library/react-hooks';
import {
  useLoadTestExecutionResults,
  useLoadTestTableData,
} from '../NetworkTestHooks';

jest.mock('@fbcnms/tg-nms/app/hooks/useSnackbar');
jest.mock('@fbcnms/tg-nms/app/apiutils/NetworkTestAPIUtil', () => ({
  getSchedules: ({inputData: {}, cancelToken: {}}) =>
    Promise.resolve([{id: 1, status: 'SCHEDULED'}]),
  getExecutions: ({inputData: {}, cancelToken: {}}) =>
    Promise.resolve([{id: 1, status: 'FINISHED'}]),
  getExecutionResults: ({executionId: {}, cancelToken: {}}) =>
    Promise.resolve({
      execution: {id: 'testExecution'},
      results: {id: 'testResults'},
    }),
}));

describe('useLoadTestExecutionResults', () => {
  test('calling useLoadTestExecutionResults loading initially ', () => {
    const {result} = renderHook(() =>
      useLoadTestExecutionResults({networkTestId: '1'}),
    );
    expect(result.current.loading).toBe(true);
  });
});

describe('useLoadTestTableData', () => {
  test('calling useLoadTestTableData initializes loading to true initially', () => {
    const {result} = renderHook(() =>
      useLoadTestTableData({
        filterOptions: {},
        inputData: {networkName: 'testNetwork'},
        actionUpdate: false,
      }),
    );
    expect(result.current.loading).toBe(true);
  });
});
