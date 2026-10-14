package notesbot.access;

import java.util.Set;

/** Белый список Telegram ID: всё, чего нет в списке, отклоняется. */
public class AccessPolicy {

  private final Set<Long> allowedIds;

  public AccessPolicy(Set<Long> allowedIds) {
    this.allowedIds = Set.copyOf(allowedIds);
  }

  public boolean isAllowed(Long telegramId) {
    return telegramId != null && allowedIds.contains(telegramId);
  }
}
