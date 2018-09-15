// generic low level reusuable utils for interacting with exchanges.

const retry = require('retry');
const errors = require('./exchangeErrors');
const _ = require('lodash');

const retryInstance = (options, checkFn, callback) => {
  if(!options) {
    options = {
      retries: 100,
      factor: 1.2,
      minTimeout: 1 * 1000,
      maxTimeout: 4 * 1000
    };
  }

  let attempt = 0;

  const operation = retry.operation(options);
  operation.attempt(function(currentAttempt) {
    checkFn((err, result) => {
      if(!err) {
        return callback(undefined, result);
      }

      let maxAttempts = err.retry;
      if(maxAttempts === true)
        maxAttempts = 10;

      if(err.retry && attempt++ < maxAttempts) {
        return operation.retry(err);
      }

      if(err.notFatal) {
        if(err.backoffDelay) {
          return setTimeout(() => operation.retry(err), err.backoffDelay);
        }

        return operation.retry(err);
      }

      callback(err, result);
    });
  });
}

// es6 bind all: https://github.com/posrix/es6-class-bind-all/blob/master/lib/es6ClassBindAll.js
const allMethods = targetClass => {
  const propertys = Object.getOwnPropertyNames(Object.getPrototypeOf(targetClass))
  propertys.splice(propertys.indexOf('constructor'), 1)
  return propertys
}

const bindAll = (targetClass, methodNames = []) => {
  for (const name of !methodNames.length ? allMethods(targetClass) : methodNames) {
    targetClass[name] = targetClass[name].bind(targetClass)
  }
}

const isValidOrder = ({api, market, amount, price}) => {
  let reason = false;

  // Check amount
  if(amount < market.minimalOrder.amount) {
    reason = 'Amount is too small';
  }

  // Some exchanges have restrictions on prices
  if(
    _.isFunction(api.isValidPrice) &&
    !api.isValidPrice(price)
  ) {
    reason = 'Price is not valid';
  }

  if(
    _.isFunction(api.isValidLot) &&
    !api.isValidLot(price, amount)
  ) {
    reason = 'Lot size is too small';
  }

  return {
    reason,
    valid: !reason
  }
}

module.exports = {
  retry: retryInstance,
  bindAll,
  isValidOrder
}