import { log } from "console";
import { ChildValidatorSet } from "../../typechain-types";

export async function isActivePosition(childValidatorSet: ChildValidatorSet, validator: string, manager: any) {
  const positiondata = await childValidatorSet.vestings(validator, manager.address);
  log("positiondata: ", positiondata);
  console.log("before");
  const res = childValidatorSet.isActivePosition(positiondata);
  console.log("after");

  return res;
}

export async function getValidatorReward(childValidatorSet: ChildValidatorSet, validatorAddr: string) {
  const validator = await childValidatorSet.getValidator(validatorAddr);
  return validator.withdrawableRewards;
}
