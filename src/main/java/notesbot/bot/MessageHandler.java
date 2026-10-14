package notesbot.bot;

import java.util.Optional;
import notesbot.access.AccessPolicy;

/** Обрабатывает входящее сообщение: постороннему не отвечает и ничего не сохраняет. */
public class MessageHandler {

  private final AccessPolicy accessPolicy;

  public MessageHandler(AccessPolicy accessPolicy) {
    this.accessPolicy = accessPolicy;
  }

  public Optional<String> handle(Long senderId, String text) {
    if (!accessPolicy.isAllowed(senderId)) {
      return Optional.empty();
    }
    return Optional.of("Принято: " + text);
  }
}
