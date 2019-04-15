/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 */
'use strict';

import axios from 'axios';
import Button from '@material-ui/core/Button';
import CustomSnackbar from '../../components/common/CustomSnackbar';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';
import EditIcon from '@material-ui/icons/Edit';
import IconButton from '@material-ui/core/IconButton';
import ListSubheader from '@material-ui/core/ListSubheader';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import LoadingBox from '../../components/common/LoadingBox';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ModalNmsConfigForm from './ModalNmsConfigForm';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import NetworkContext from '../../NetworkContext';
import NetworkListContext from '../../NetworkListContext';
import Paper from '@material-ui/core/Paper';
import PlaylistAddIcon from '@material-ui/icons/PlaylistAdd';
import React from 'react';
import {requestWithConfirmation} from '../../apiutils/ServiceAPIUtil';
import StatusIndicator, {
  StatusIndicatorColor,
} from '../../components/common/StatusIndicator';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import {withStyles} from '@material-ui/core/styles';

const styles = theme => ({
  root: {
    padding: theme.spacing.unit,
  },
  button: {
    margin: theme.spacing.unit,
  },
  leftIcon: {
    paddingRight: theme.spacing.unit,
  },
  paper: {
    flexGrow: 1,
    padding: theme.spacing.unit,
    margin: theme.spacing.unit,
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  },
  headerCell: {
    fontWeight: 'bold',
  },
  row: {
    '&:nth-of-type(odd)': {
      backgroundColor: theme.palette.background.default,
    },
  },
  flexRow: {
    display: 'flex',
    alignItems: 'center',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
  vertCenter: {
    verticalAlign: 'middle',
  },
  centerText: {
    textAlign: 'center',
  },
  controllerInfo: {
    lineHeight: 1.5,
  },
  menuIconButton: {
    padding: 6,
    marginLeft: -12,
    marginRight: 4,
  },
  deleteIcon: {
    color: '#c0392a',
  },
});

const columns = [
  'Network',
  'Primary Controller',
  'Backup Controller',
  'Wireless AP Controller',
];

class NmsConfig extends React.Component {
  state = {
    menuAnchorEl: null,
    menuNetworkName: null,
    modalProps: {open: false},
    snackbarProps: {open: false},
  };

  constructor(props) {
    super(props);
  }

  updateSnackbar(message, variant) {
    // Show a new snackbar message
    this.setState({snackbarProps: {open: true, message, variant}});
  }

  onCreateNetwork = (data, waitForNetworkListRefresh, onResolve, onReject) => {
    // Create a network
    axios
      .post(`/topology/create`, data)
      .then(response => {
        waitForNetworkListRefresh();
        this.updateSnackbar('Network created!', 'success');
        onResolve && onResolve(response);
      })
      .catch(err => {
        const errorText =
          err.response && err.response.data && err.response.data.msg
            ? err.response.data.msg
            : 'Unable to create new network.';
        this.updateSnackbar(errorText, 'error');
        onReject && onReject(err);
      });
  };

  onEditNetwork = (data, waitForNetworkListRefresh, onResolve, onReject) => {
    // Edit a network
    axios
      .post(`/topology/update/${data.id}`, data)
      .then(response => {
        waitForNetworkListRefresh();
        this.updateSnackbar('Network updated!', 'success');
        onResolve && onResolve(response);
      })
      .catch(err => {
        const errorText =
          err.response && err.response.data && err.response.data.msg
            ? err.response.data.msg
            : 'Unable to save.';
        this.updateSnackbar(errorText, 'error');
        onReject && onReject(err);
      });
  };

  onDeleteNetwork = (id, waitForNetworkListRefresh, onResolve, onReject) => {
    // Delete a network
    axios
      .post(`/topology/delete/${id}`)
      .then(response => {
        waitForNetworkListRefresh();
        this.updateSnackbar('Network deleted!', 'success');
        onResolve && onResolve(response);
      })
      .catch(err => {
        const errorText =
          err.response && err.response.data && err.response.data.msg
            ? err.response.data.msg
            : 'Unable to delete network.';
        this.updateSnackbar(errorText, 'error');
        onReject && onReject(err);
      });
  };

  handleMenuClose = () => {
    // Close the actions menu
    this.setState({menuAnchorEl: null});
  };

  handleModalClose = () => {
    // Close the form modal
    this.setState({modalProps: {...this.state.modalProps, open: false}});
  };

  handleAddNetwork = () => {
    // Open the modal to add a new network
    this.setState({modalProps: {open: true, type: 'CREATE'}});
  };

  handleEditNetwork(networkConfig, _waitForNetworkListRefresh) {
    // Open the modal to edit a network
    this.setState({modalProps: {open: true, type: 'EDIT', networkConfig}});
  }

  handleDeleteNetwork(networkConfig, waitForNetworkListRefresh) {
    // Delete the given network with confirmation
    const makeRequest = _requestData =>
      new Promise((resolve, reject) => {
        this.onDeleteNetwork(
          networkConfig.id,
          waitForNetworkListRefresh,
          resolve,
          reject,
        );
      });

    requestWithConfirmation(makeRequest, {
      desc: `The network <strong>${
        networkConfig.name
      }</strong> will be permanently deleted.`,
      descType: 'html',
      onResultsOverride: () => {},
    });
  }

  renderControllerRow(controllerConfig) {
    // Render a controller's config as table cells
    // controller_online verifies both API service and the E2E
    const {classes} = this.props;
    const {
      api_ip,
      e2e_ip,
      api_port,
      e2e_port,
      controller_online,
    } = controllerConfig;
    const {GREEN, RED} = StatusIndicatorColor;

    return (
      <TableCell className={classes.noWrap} padding="dense">
        {api_ip ? (
          <span className={classes.flexRow}>
            <StatusIndicator color={controller_online ? GREEN : RED} />
            <span className={classes.controllerInfo}>
              <span>
                <strong>API:</strong> {api_ip} &nbsp;/&nbsp; {api_port}
              </span>
              <br />
              <span>
                <strong>E2E:</strong> {e2e_ip ? e2e_ip : <em>addr not set</em>}
                &nbsp;/&nbsp;
                {e2e_port ? e2e_port : <em>port not set</em>}
              </span>
            </span>
          </span>
        ) : (
          <em>not set</em>
        )}
      </TableCell>
    );
  }

  render() {
    return (
      <NetworkListContext.Consumer>
        {listContext => (
          <NetworkContext.Consumer>
            {networkContext => this.renderContext(listContext, networkContext)}
          </NetworkContext.Consumer>
        )}
      </NetworkListContext.Consumer>
    );
  }

  renderContext = (listContext, _networkContext): ?React.Element => {
    const {classes} = this.props;
    const {
      menuAnchorEl,
      menuNetworkName,
      modalProps,
      snackbarProps,
    } = this.state;
    const {networkList} = listContext;
    const {waitForNetworkListRefresh} = listContext;

    // render loading icon while waiting for network list
    if (!networkList) {
      return <LoadingBox />;
    }
    const hasNetworks = Object.keys(networkList).length > 0;

    return (
      <div className={classes.root}>
        <Button
          variant="outlined"
          className={classes.button}
          onClick={this.handleAddNetwork}>
          <PlaylistAddIcon className={classes.leftIcon} />
          Create Network
        </Button>

        <Paper className={classes.paper}>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                {columns.map(col => (
                  <TableCell
                    key={col}
                    className={classes.headerCell}
                    padding="dense">
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            {networkList ? (
              <TableBody>
                {hasNetworks ? (
                  Object.keys(networkList).map(networkName => {
                    const networkConfig = networkList[networkName];
                    const {
                      primary,
                      backup,
                      wireless_controller,
                    } = networkConfig;
                    return (
                      <TableRow key={networkName} className={classes.row}>
                        <TableCell
                          className={classes.noWrap}
                          component="th"
                          scope="row"
                          padding="dense">
                          <IconButton
                            classes={{root: classes.menuIconButton}}
                            onClick={ev =>
                              this.setState({
                                menuAnchorEl: ev.currentTarget,
                                menuNetworkName: networkName,
                              })
                            }>
                            <MoreVertIcon />
                          </IconButton>
                          <strong className={classes.vertCenter}>
                            {networkName}
                          </strong>
                        </TableCell>
                        {this.renderControllerRow(primary || {})}
                        {this.renderControllerRow(backup || {})}
                        <TableCell padding="dense">
                          {wireless_controller?.url || <em>not set</em>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      className={classes.centerText}
                      colSpan={columns.length}>
                      Click on the "Create Network" button to get started!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            ) : null}
          </Table>
        </Paper>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          MenuListProps={{
            subheader: (
              <ListSubheader component="div">
                <strong>{menuNetworkName}</strong>
              </ListSubheader>
            ),
          }}
          onClose={this.handleMenuClose}>
          <MenuItem
            onClick={() => {
              this.handleEditNetwork(
                networkList[menuNetworkName],
                waitForNetworkListRefresh,
              );
              this.handleMenuClose();
            }}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText inset primary="Edit Network" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              this.handleDeleteNetwork(
                networkList[menuNetworkName],
                waitForNetworkListRefresh,
              );
              this.handleMenuClose();
            }}>
            <ListItemIcon>
              <DeleteForeverIcon className={classes.deleteIcon} />
            </ListItemIcon>
            <ListItemText inset primary="Delete Network" />
          </MenuItem>
        </Menu>

        <ModalNmsConfigForm
          {...modalProps}
          onClose={this.handleModalClose}
          onCreateNetwork={this.onCreateNetwork}
          onEditNetwork={this.onEditNetwork}
          networkList={networkList}
        />

        <CustomSnackbar
          {...snackbarProps}
          onClose={(_event, _reason) =>
            this.setState({snackbarProps: {...snackbarProps, open: false}})
          }
        />
      </div>
    );
  };
}

export default withStyles(styles, {withTheme: true})(NmsConfig);