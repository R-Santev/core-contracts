/* eslint-disable camelcase */
/* eslint-disable no-undef */
import { ValidatorSet__factory } from "../../typechain-types";

async function validatorSetFixtureFunction(this: Mocha.Context) {
  const validatorSetFactory = new ValidatorSet__factory(this.signers.admin);
  const validatorSet = await validatorSetFactory.deploy();

  return validatorSet;
}

export async function generateFixtures(context: Mocha.Context) {
  context.fixtures.validatorSetFixture = validatorSetFixtureFunction.bind(context);
}
