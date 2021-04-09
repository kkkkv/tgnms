/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow
 */

import * as React from 'react';
import CnConfig from '../../components/taskBasedConfig/configTasks/CnConfig';
import FluentdEndpoints from '../../components/taskBasedConfig/configTasks/FluentdEndpoints';
import Grid from '@material-ui/core/Grid';
import KafkaParams from '../../components/taskBasedConfig/configTasks/KafkaParams';
import NetworkEnvParams from '../../components/taskBasedConfig/configTasks/NetworkEnvParams';
import NetworkRouting from '../../components/taskBasedConfig/configTasks/NetworkRouting';
import NetworkSnmp from '../../components/taskBasedConfig/configTasks/NetworkSnmp';
import PopKvstoreParams from '../../components/taskBasedConfig/configTasks/PopKvstoreParams';
import PopRouting from '../../components/taskBasedConfig/configTasks/PopRouting';
import RadioParams from '../../components/taskBasedConfig/configTasks/RadioParams';
import StatsAgentParams from '../../components/taskBasedConfig/configTasks/StatsAgentParams';
import SysParams from '../../components/taskBasedConfig/configTasks/SysParams';
import Typography from '@material-ui/core/Typography';
import {
  CONFIG_FORM_MODE,
  CONFIG_FORM_MODE_DESCRIPTION,
  FORM_CONFIG_MODES,
} from '../../constants/ConfigConstants';
import {makeStyles} from '@material-ui/styles';
import {useConfigTaskContext} from '../../contexts/ConfigTaskContext';

const useStyles = makeStyles(theme => ({
  root: {
    overflow: 'scroll',
    overflowX: 'hidden',
    margin: theme.spacing(2),
  },
}));

export default function ConfigQuickSettingsForm() {
  const {editMode, selectedValues} = useConfigTaskContext();
  const classes = useStyles();

  let formMode = CONFIG_FORM_MODE.NETWORK;
  if (editMode === FORM_CONFIG_MODES.NODE) {
    if (selectedValues.nodeInfo?.isCn) {
      formMode = CONFIG_FORM_MODE.CN;
    } else if (selectedValues.nodeInfo?.isPop) {
      formMode = CONFIG_FORM_MODE.POP;
    } else {
      formMode = CONFIG_FORM_MODE.NODE;
    }
  }

  const {title, description} = CONFIG_FORM_MODE_DESCRIPTION[formMode];

  return (
    <div className={classes.root}>
      <Grid item container direction={'column'} spacing={4}>
        <Grid item xs={12}>
          {title && <Typography variant="h6">{title}</Typography>}
          {description && (
            <Typography variant="body2" color="textSecondary">
              {description}
            </Typography>
          )}
        </Grid>
        <Grid item xs={12}>
          {formMode === 'NETWORK' && (
            <>
              <SysParams />
              <NetworkRouting />
              <NetworkEnvParams />
              <FluentdEndpoints />
              <NetworkSnmp />
              <KafkaParams />
              <StatsAgentParams />
              <RadioParams />
            </>
          )}
          {formMode === 'POP' && (
            <>
              <PopRouting />
              <PopKvstoreParams />
            </>
          )}
          {formMode === 'CN' && <CnConfig />}
          {formMode === 'NODE' && (
            <>
              <SysParams />
              <RadioParams />
            </>
          )}
        </Grid>
      </Grid>
    </div>
  );
}