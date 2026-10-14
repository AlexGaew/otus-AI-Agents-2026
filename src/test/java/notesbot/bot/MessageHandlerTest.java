package notesbot.bot;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import notesbot.access.AccessPolicy;
import org.junit.jupiter.api.Test;

class MessageHandlerTest {

  private final MessageHandler handler = new MessageHandler(new AccessPolicy(Set.of(42L)));

  @Test
  void repliesToWhitelistedUser() {
    var reply = handler.handle(42L, "привет");

    assertThat(reply).isPresent();
  }

  @Test
  void staysSilentForStranger() {
    var reply = handler.handle(7L, "привет");

    assertThat(reply).isEmpty();
  }
}
