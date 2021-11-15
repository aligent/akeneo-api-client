declare module "akeneo" {
	export namespace Akeneo {
		export interface AuthenticationResponse {
			access_token: string;
			refresh_token: string;
		}

		export interface Product {
			identifier: string;
			family: string;
			groups: string[];
			parent?: string;
			categories: string[];
			enabled: boolean;
			values: AkeneoProductValues;
		}

		interface AkeneoProductValues {
			name: AkeneoProductValue<string>[];
			model_number: AkeneoProductValue<string>[];
			images?: AkeneoProductValue<string[]>[];
			brand: AkeneoProductValue<string>[];
			price: AkeneoProductValue<AkeneoPrice[]>[];
			description: AkeneoProductValue<string>[];
		}

		interface AkeneoProductValue<Type> {
			locale?: string;
			scope?: string;
			data: Type;
		}

		export interface AkeneoPrice {
			amount: string;
			currency: string;
		}
	}
}
