/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow strict-local
 */

import 'jest-dom/extend-expect';
import * as ScheduleHelpers from '../ScheduleHelpers';
import {DAYS, FREQUENCIES} from '../../constants/ScheduleConstants';
import {cleanup} from '@testing-library/react';

afterEach(cleanup);

/*
 * input is a cron string in format * * * * *
 * where the stars are (1)minute (2)hour (3)day of month (4)month (5)weekday
 * for example: '0 3 * * 1' stands for every Monday at 3am UTC
 * this parser also convets time to local time,
 * so getParsedCronString('0 3 * * 1') returns:
 * {
 *  initialFrequency: FREQUENCIES.weekly,
 *  initialTime: '5/8/20, 08:00 PM',
 *  initialDay:'Monday'
 * }
 */
test('test parsing cron string', () => {
  const parsedResult = ScheduleHelpers.getParsedCronString({
    cronString: '0 3 * * 1',
  });
  expect(parsedResult.initialFrequency).toEqual(FREQUENCIES.weekly);
  expect(parsedResult.initialTime).toEqual(expectedDate());
  expect(parsedResult.initialDay).toEqual(DAYS.MON);
});

test('test parsing cron string monthly', () => {
  const parsedResult = ScheduleHelpers.getParsedCronString({
    cronString: '0 3 4 * *',
  });

  expect(parsedResult.initialFrequency).toEqual(FREQUENCIES.monthly);
  expect(parsedResult.initialTime).toEqual(expectedDate());
  expect(parsedResult.initialDay).toEqual('4');
});

const expectedDate = () => {
  const day = new Date().getUTCDate();
  const month = new Date().getUTCMonth();
  const year = new Date().getUTCFullYear();

  return new Date(Date.UTC(year, month, day, 3, 0, 0)).toLocaleString([], {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};