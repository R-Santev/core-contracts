// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
// eslint-disable-next-line node/no-unsupported-features/es-builtins, no-extend-native
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};
