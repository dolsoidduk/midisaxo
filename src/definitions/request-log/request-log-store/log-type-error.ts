import { LogType, ILogEntryBase } from "./state";
import { ErrorCode, getErrorDefinition } from "../../../definitions";
import { logger } from "../../../util";
import { addBuffered } from "./actions";

export interface ILogEntryError extends ILogEntryBase {
  type: LogType.Error;
  message?: string;
  errorCode?: ErrorCode;
  error?: Error;
  requestId?: number;
}

interface ErrorParams {
  message?: string;
  error?: Error;
  errorCode?: ErrorCode;
  payload?: number[];
  requestId?: number;
}

export const addError = (params: ErrorParams): void => {
  addBuffered({
    type: LogType.Error,
    ...params,
  });

  if (params.errorCode) {
    const errorCode = Number(params.errorCode);
    const definition = getErrorDefinition(errorCode as ErrorCode);
    // NOT_SUPPORTED is a normal/expected response when a board/target doesn't
    // implement every possible config section. It is handled by disabling the
    // control, so avoid spamming the console.
    if (errorCode === ErrorCode.NOT_SUPPORTED) {
      return;
    }

    logger.error(definition.description, params.error);
  } else {
    logger.error(params.message, params.error);
  }
};
