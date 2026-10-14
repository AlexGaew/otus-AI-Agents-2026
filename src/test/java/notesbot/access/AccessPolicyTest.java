package notesbot.access;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class AccessPolicyTest {

  @Test
  void allowsUserFromWhitelist() {
    var policy = new AccessPolicy(Set.of(42L));

    assertThat(policy.isAllowed(42L)).isTrue();
  }

  @Test
  void deniesUserOutsideWhitelist() {
    var policy = new AccessPolicy(Set.of(42L));

    assertThat(policy.isAllowed(7L)).isFalse();
  }

  @Test
  void deniesEveryoneWhenWhitelistIsEmpty() {
    var policy = new AccessPolicy(Set.of());

    assertThat(policy.isAllowed(42L)).isFalse();
  }

  @Test
  void deniesUnknownSender() {
    var policy = new AccessPolicy(Set.of(42L));

    assertThat(policy.isAllowed(null)).isFalse();
  }
}
