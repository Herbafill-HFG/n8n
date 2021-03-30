import {
	IExecuteFunctions,
	IHookFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

import {
	OptionsWithUri,
} from 'request';

/**
 * Make an authenticated API request to Lemlist.
 */
export async function lemlistApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: string,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	option: IDataObject = {},
) {

	const { apiKey } = this.getCredentials('lemlistApi') as {
		apiKey: string,
	};

	const encodedApiKey = Buffer.from(':' + apiKey).toString('base64');

	const options: OptionsWithUri = {
		headers: {
			'user-agent': 'n8n',
			'Authorization': `Basic ${encodedApiKey}`,
		},
		method,
		uri: `https://api.lemlist.com/api${endpoint}`,
		qs,
		body,
		json: true,
	};

	if (!Object.keys(body).length) {
		delete options.body;
	}

	if (!Object.keys(qs).length) {
		delete options.qs;
	}

	if (Object.keys(option)) {
		Object.assign(options, option);
	}

	try {
		return await this.helpers.request!(options);
	} catch (error) {

		if (error?.response?.body) {
			throw new Error(`Lemlist error response [${error.statusCode}]: ${error?.response?.body}`);
		}

		throw error;
	}
}

/**
 * Make an authenticated API request to Lemlist and return all results.
 */
export async function lemlistApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: string,
	endpoint: string,
) {
	const returnData: IDataObject[] = [];

	let responseData;
	const qs: IDataObject = {};

	qs.limit = 100;
	qs.offset = 0;

	do {
		responseData = await lemlistApiRequest.call(this, method, endpoint, {}, qs);
		returnData.push(...responseData);
		qs.offset += qs.limit;
	} while (
		responseData.length !== 0
	);
	return returnData;
}
