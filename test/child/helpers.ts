import { ChildValidatorSet } from "../../typechain-types";

export async function isActivePosition(childValidatorSet: ChildValidatorSet, validator: string, manager: any) {
  const positiondata = await childValidatorSet.vestings(validator, manager.address);
  const res = childValidatorSet.isActivePosition(positiondata);

  return res;
}

export async function getValidatorReward(childValidatorSet: ChildValidatorSet, validatorAddr: string) {
  const validator = await childValidatorSet.getValidator(validatorAddr);
  return validator.withdrawableRewards;
}
