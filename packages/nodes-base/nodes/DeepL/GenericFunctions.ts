import {
	OptionsWithUri,
} from 'request';

import {
	IExecuteFunctions,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
} from 'n8n-core';

import {
	IDataObject,
} from 'n8n-workflow';

export async function deepLApiRequest(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	uri?: string,
	headers: IDataObject = {},
) {

	const options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body,
		qs,
		uri: uri || `https://api.deepl.com/v2${resource}`,
		json: true,
	};

	try {
		if (Object.keys(headers).length !== 0) {
			options.headers = Object.assign({}, options.headers, headers);
		}

		if (Object.keys(body).length === 0) {
			delete options.body;
		}

		const credentials = this.getCredentials('deepLApi');

		if (credentials === undefined) {
			throw new Error('No credentials got returned!');
		}

		options.qs.auth_key = credentials.apiKey;

		return await this.helpers.request!(options);

	} catch (error) {
		if (error?.response?.body?.message) {
			// Try to return the error prettier
			throw new Error(`DeepL error response [${error.statusCode}]: ${error.response.body.message}`);
		}
		throw error;
	}
}
