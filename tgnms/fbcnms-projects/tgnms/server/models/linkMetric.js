/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @format
 * @flow
 */
'use strict';
import type Sequelize, {DataTypes as DataTypesType, Model} from 'sequelize';

export default function(sequelize: Sequelize, DataTypes: DataTypesType) {
  const LinkMetric = sequelize.define(
    'link_metric',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      key_name: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      key_prefix: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING,
        unique: true,
      },
      description: {
        allowNull: false,
        type: DataTypes.STRING,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    },
  );

  return LinkMetric;
}

type LinkMetricAttributes = {|
  id: number,
  key_name: string,
  key_prefix: string,
  name: string,
  description: string,
|};

export type LinkMetric = LinkMetricAttributes & Model<LinkMetricAttributes>;