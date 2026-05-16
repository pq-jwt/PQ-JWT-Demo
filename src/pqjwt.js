/**
 * Re-exports full @pq-jwt/core surface for app/scripts.
 * Use this single import path in project code.
 */
export {
  SUPPORTED_ALGORITHMS,
  algorithmInfo,
  generateKeyPair,
  exportKey,
  importKey,
  sign,
  verify,
  decode,
  refresh,
  PQJWTError,
  TokenExpiredError,
  InvalidTokenError,
  SignatureError,
} from "@pq-jwt/core";
