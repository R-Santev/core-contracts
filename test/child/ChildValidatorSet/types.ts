import * as mcl from "../../../ts/mcl";

export interface ValidatorBLS {
  signature: mcl.solG1;
  pubkey: mcl.solG2;
}
