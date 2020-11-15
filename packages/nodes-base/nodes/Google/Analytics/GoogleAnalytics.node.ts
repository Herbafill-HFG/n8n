import { 
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { 
	reportFields,
	reportOperations,
} from './reportDescription';

import { 
	userActivityFields,
	userActivityOperations,
} from './userActivityDescription';

import { 
	googleApiRequest,
	googleApiRequestAllItems,
} from './GenericFunctions';

import * as moment from 'moment-timezone';

export class GoogleAnalytics implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Google Analytics',
		name: 'googleAnalytics',
		icon: 'file:analytics.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Use the Google Analytics API',
		defaults: {
			name: 'Google Analytics',
			color: '#772244',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'googleAnalyticsOAuth2',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Report',
						value: 'report',
					},
					{
						name: 'User Activity',
						value: 'userActivity',
					},
				],
				default:'report',
			},
			//-------------------------------
			// Reports Operations
			//-------------------------------
			...reportOperations,
			...reportFields,

			//-------------------------------
			// User Activity Operations
			//-------------------------------
			...userActivityOperations,
			...userActivityFields,
		],
	};

	methods = {
		loadOptions: {
			// Get all the dimensions to display them to user so that he can
			// select them easily
			async getDimensions(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const { items: dimensions } = await googleApiRequest.call(
					this,
					'GET',
					'',
					{},
					{},
					'https://www.googleapis.com/analytics/v3/metadata/ga/columns',
				);

				for (const dimesion of dimensions) {
					if (dimesion.attributes.status !== 'DEPRECATED') {
						returnData.push({
							name: dimesion.attributes.uiName,
							value: dimesion.id,
							description: dimesion.attributes.description,
						});
					}
				}
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		let method = '';
		const qs: IDataObject = {};
		let endpoint = '';
		let responseData;
		for (let i = 0; i < items.length; i++) {
			if(resource === 'report') {
				if(operation === 'get') {
					//https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet
					method = 'POST';
					endpoint = '/v4/reports:batchGet';
					const viewId = this.getNodeParameter('viewId', i) as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						i,
					) as IDataObject;
					const simple = this.getNodeParameter('simple', i) as boolean;

					interface IData {
						viewId: string;
						dimensions?: IDimension[];
						pageSize?: number;
						metrics?: IMetric[];
					}

					interface IDimension  {
						name?: string;
						histogramBuckets?: string[];
					}

					interface IMetric  {
						expression?: string;
						alias?: string;
						formattingType?: string;
					}

					const body: IData = {
							viewId,
					};

					if(additionalFields.useResourceQuotas){
						qs.useResourceQuotas = additionalFields.useResourceQuotas;
					}
					if(additionalFields.dateRangesUi){
						const dateValues = (additionalFields.dateRangesUi as IDataObject).dateRanges as IDataObject;
						if(dateValues){
							const start = dateValues.startDate as string;
							const end = dateValues.endDate as string;
							Object.assign(
								body, 
								{
									dateRanges:
									[
										{
											startDate: moment(start).utc().format('YYYY-MM-DD'),
											endDate: moment(end).utc().format('YYYY-MM-DD'),
										},
									],
								},
							);
						}
					}
					if(additionalFields.metricsUi) {
						const metrics = (additionalFields.metricsUi as IDataObject).metricsValues as IDataObject[];
						body.metrics = metrics;
					}
					if(additionalFields.dimensionUi){
						const dimensions = (additionalFields.dimensionUi as IDataObject).dimensionValues as IDataObject[];
						if (dimensions) {
							body.dimensions = dimensions;
						}
					}
					if(additionalFields.includeEmptyRows){
						Object.assign(body, { includeEmptyRows: additionalFields.includeEmptyRows });
					}
					if(additionalFields.hideTotals){
						Object.assign(body, { hideTotals: additionalFields.hideTotals });
					}
					if(additionalFields.hideValueRanges){
						Object.assign(body, { hideTotals: additionalFields.hideTotals });
					}

					responseData = await googleApiRequest.call(this, method, endpoint,  { reportRequests: [body] }, qs);
					responseData = responseData.reports;		

					if (simple === true) {
						const { columnHeader: { dimensions }, data: { rows } } = responseData[0];
						responseData = [];
						for (const row of rows) {
							const data: IDataObject = {};
							for (let i = 0; i < dimensions.length; i++) {
								data[dimensions[i]] = row.dimensions[i];
								data['total'] = row.metrics[0].values.join(',');
							}
							responseData.push(data);
						}
					}
				}
			}
			if(resource === 'userActivity') {
				if(operation === 'search') {
					// https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/userActivity/search
					method = 'POST';
					endpoint = '/v4/userActivity:search';
					const viewId = this.getNodeParameter('viewId', i);
					const userId = this.getNodeParameter('userId', i);
					const returnAll = this.getNodeParameter('returnAll', 0) as boolean;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						i,
					) as IDataObject;
					const body: IDataObject = {
						viewId,
						user: {
							userId,
						},
					};
					if(additionalFields.activityTypes){
						Object.assign(body,{activityTypes:additionalFields.activityTypes});
					}

					if (returnAll) {
						responseData = await googleApiRequestAllItems.call(this, 'sessions', method, endpoint, body);
					} else {
						body.pageSize = this.getNodeParameter('limit', 0) as number;
						responseData = await googleApiRequest.call(this, method, endpoint, body);
						responseData = responseData.sessions;
					}
				}
			}
			if (Array.isArray(responseData)) {
				returnData.push.apply(returnData, responseData as IDataObject[]);
			} else if (responseData !== undefined) {
				returnData.push(responseData as IDataObject);
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}