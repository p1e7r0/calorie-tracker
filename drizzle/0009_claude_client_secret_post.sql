UPDATE "oauth_client" SET "token_endpoint_auth_method" = 'client_secret_post' WHERE "name" = 'Claude' AND "token_endpoint_auth_method" = 'client_secret_basic';
