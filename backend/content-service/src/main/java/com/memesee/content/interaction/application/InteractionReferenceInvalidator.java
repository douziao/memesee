package com.memesee.content.interaction.application;

public interface InteractionReferenceInvalidator {

    void invalidateInteractionListsReferencingMainPost(Long mainPostId);

    void invalidateInteractionListsReferencingSubPost(Long subPostId);
}
