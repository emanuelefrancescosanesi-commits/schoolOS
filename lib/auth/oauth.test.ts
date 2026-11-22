import { describe, expect, it } from "vitest";
import { oauthErrorKey } from "./oauth";

const q = (s: string) => new URLSearchParams(s);

describe("oauthErrorKey", () => {
  it("riconosce l'annullamento da parte dell'utente", () => {
    expect(oauthErrorKey(q("error=access_denied&error_description=User+denied"))).toBe("oauth_denied");
  });
  it("riconosce il provider non abilitato", () => {
    expect(oauthErrorKey(q("error=invalid_request&error_code=validation_failed&error_description=Unsupported+provider"))).toBe(
      "oauth_unavailable",
    );
  });
  it("ripiega sul messaggio generico", () => {
    expect(oauthErrorKey(q("error=server_error"))).toBe("oauth");
    expect(oauthErrorKey(q(""))).toBe("oauth");
  });
});
