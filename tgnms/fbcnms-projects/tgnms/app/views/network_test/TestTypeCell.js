

import * as React from 'react';

import {
  TEST_TYPE,
} from '../../../shared/dto/TestExecution';
import {makeStyles} from '@material-ui/styles';

const useTestTypeStyles = makeStyles({
  cell: {
    textTransform: 'capitalize',
  },
});

export default function TestTypeCell({test_code}) {
  const classes = useTestTypeStyles();
  const testTypeText = convertTestCodeToString(test_code)
  return (
    <span className={classes.cell} title={`Test Code: ${test_code}`}>
      {testTypeText}
    </span>
  );
}

export function convertTestCodeToString(test_code:string){
  let testTypeText = TEST_TYPE[test_code];
  if (!testTypeText) {
    testTypeText = test_code;
  }
  return testTypeText
}