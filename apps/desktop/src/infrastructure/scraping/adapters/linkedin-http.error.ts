// A LinkedIn guest page answered with a non-success HTTP status.
export class LinkedInHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "LinkedInHttpError";
  }
}
