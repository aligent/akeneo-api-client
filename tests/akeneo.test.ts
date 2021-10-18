import { AkeneoClient } from "../src/lib/akeneo"
import axios from 'axios';
jest.mock('axios');

afterEach(() => {    
     jest.clearAllMocks();
});

describe('Akeneo Authentication', () => {
    test('Fails if the authentication response is invalid', async () => {
          const mockResponse = {data:{someRandomeKey: 'some random data'}};
          (axios.post as jest.Mock).mockResolvedValue(mockResponse);
		  const client = new AkeneoClient({
			  host: 'https://my-test-host',
			  username: 'john.doe',
			  password: 'abcd3fgh1jk',
			  oauthClientId: 'clientId1',
			  oauthClientSecret: 'clientSecret1',
		  });

          await expect(client.authenticate()).rejects.toThrow("Invalid repsonse from Akeneo / token endpoint.")
    });

    test('Parses auth and refresh tokens from a valid response', async () => {
          const mockResponse = {data:{
               access_token: "ABCD1234",
               expires_in: 3600,
               token_type: "bearer",
               scope: "null",
               refresh_token: "4321DCBA"
          }};
          (axios.post as jest.Mock).mockResolvedValue(mockResponse);
		  const client = new AkeneoClient({
			  host: 'https://my-test-host',
			  username: 'john.doe',
			  password: 'abcd3fgh1jk',
			  oauthClientId: 'clientId1',
			  oauthClientSecret: 'clientSecret1',
		  });

          expect((await client.authenticate()).access_token).toEqual("ABCD1234")
          expect((await client.authenticate()).refresh_token).toEqual("4321DCBA")
    });
});