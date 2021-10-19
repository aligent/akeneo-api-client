import 'source-map-support/register';
import axios, { AxiosResponse, AxiosError } from 'axios';
import FormData from 'form-data';
import { Akeneo } from 'akeneo';

const GRANT_TYPE  = 'password';

export interface AkeneoConfig {
	host: string
	username: string,
	password: string,
	oauthClientId: string,
	oauthClientSecret: string,
}

interface PatchRequestData {
	entity: string;
	id: string;
	// Because the Axios library takes an `any` as it's body type
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	body: any;
	accessToken: string;
}

export class AkeneoClient {
	config: AkeneoConfig;

	constructor(config: AkeneoConfig) {
		this.config = config
	}

	/**
	 * Performs an Akeneo authentication request and returns the authentication details.
	 * https://api.akeneo.com/documentation/authentication.html
	 *
	 * @return {Promise<AxiosResponse>} The response from the Akeneo API
	 */
	authenticate = (): Promise<Akeneo.AuthenticationResponse> => {
		const { host, username, password, oauthClientId, oauthClientSecret } = this.config;

		const data = {
			username: username,
			password: password,
			grant_type: GRANT_TYPE
		};

		const tokenURL = `https://${host}/api/oauth/v1/token`;
		const credentials = Buffer.from(`${oauthClientId}:${oauthClientSecret}`).toString('base64');

		return axios.post(tokenURL, data, {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Basic ${credentials}`
			}
		}).then(function (response) {
			if (!("access_token" in response.data &&
				"refresh_token" in response.data)) {
				throw Error('Invalid repsonse from Akeneo / token endpoint.');
			}

			return {
				access_token: response.data.access_token,
				refresh_token: response.data.refresh_token,
			} as Akeneo.AuthenticationResponse
		});
	};

	/**
	 * Performs a patch request against the Akeneo API for the given product.
	 *
	 * @param {Akeneo.Product} product - Product to suplpier to Akeneo
	 * @return {Promise<AxiosResponse>} The response from the Akeneo API
	 */
	patchProduct = (product: Akeneo.Product): Promise<AxiosResponse> => {
		return this.authenticate()
			.then((res) => {
				return this.patchRequest({ entity: 'products', id: product.identifier, body: product, accessToken: res.access_token });
			}).catch((error: AxiosError) => {
				// If brand does not exist, attempt again without brand.
				if (error.response.data.code == 422 &&
					error.response.data.message.includes('Validation failed') &&
					error.response.data.errors[0].message.includes('Property "brand" expects a valid record code')) {

					delete product.values.brand;

					return this.authenticate()
						.then((res) => {
							return this.patchRequest({ entity: 'products', id: product.identifier, body: product, accessToken: res.access_token });
						});
				}
				throw error;
			});
	};

	/**
	 * Performs a patch request against the Akeneo API for the given product.
	 *
	 * @param {PatchRequestData} Patch request data values
	 * @return {Promise<AxiosResponse>} The response from the Akeneo API
	 */
	patchRequest = ({ entity, id, body, accessToken }: PatchRequestData): Promise<AxiosResponse> => {
		const { host } = this.config;
		const patchBaseURL = `https://${host}/api/rest/v1/${entity}/${id}`;

		return axios.patch(patchBaseURL, body, {
			timeout: 5000,
			headers: {
				'Content-type': 'application/json',
				'Accept': 'application/json',
				'Authorization': `Bearer ${accessToken}`
			}

		});
	};

	/**
	 * Takes a path to a media file (from supplier feed) downloads and re-uploads to
	 * Akeneo.
	 *
	 * @param {string} supplierImageUrl - Url to the media file
	 * @return {Promise<string>} The asset-media-file-code for the uploaded file.
	 */
	relayMediaFile = async (supplierImageUrl: string): Promise<string> => {
		return this.authenticate()
			.then(async (res) => {
				const { host } = this.config;
				const assetPostBaseUrl = `https://${host}/api/rest/v1/asset-media-files`;

				const mediaExtension = supplierImageUrl.split(/[#?]/)[0].split('.').pop().trim();
				if (!mediaExtension) {
					throw new Error('Could not determin media asset file extension');
				}
				const supplierImageRequest = await axios.get(supplierImageUrl, {
					responseType: 'arraybuffer'
				});

				const formData = new FormData();
				formData.append('file', supplierImageRequest.data, `image.${mediaExtension}`);

				return axios({
					method: 'post',
					url: assetPostBaseUrl,
					// Akeneo's asset media upload does not seem to support streaming.
					// Submitting without a content-length will fail.
					// Write the formData to a buffer first.
					data: formData.getBuffer(),
					headers: {
						'Authorization': `Bearer ${res.access_token}`,
						'accept': '*/*',
						...formData.getHeaders()
					}
				}).then((res: AxiosResponse) => {
					const mediaCode = res.headers['asset-media-file-code'];

					if (!mediaCode || mediaCode == '') {
						throw new Error('Failed to upload media to Akeneo');
					}

					return mediaCode;
				});
			});
	}

	/**
	 * Performs a patch request against the Akeneo assets API.
	 *
	 * @param {string} assetId - The unique identifier of the asset
	 * @param {string} assetFamily - The "AssetFamily" to assign the asset to
	 * @param {string} mediaFileCode - The identifier of the media file to be attached
	 * @return {Promise<AxiosResponse>} The response from the API.
	 */
	patchAsset = (assetId: string, assetFamily: string, mediaFileCode: string): Promise<AxiosResponse> => {
		return this.authenticate()
			.then((res) => {
				return this.patchRequest({
					entity: `asset-families/${assetFamily}/assets`,
					id: assetId,
					accessToken: res.access_token,
					body: {
						code: assetId,
						values: {
							media: [
								{
									locale: null,
									channel: null,
									data: mediaFileCode
								}
							]
						}
					}
				});
			});
	}
}