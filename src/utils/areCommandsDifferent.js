module.exports = (existingCommand, localCommand) => {
  const areChoicesDifferent = (existingChoices, localChoices) => {
    for (const localChoice of localChoices) {
      const existingChoice = existingChoices?.find(
        (choice) => choice.name === localChoice.name,
      );

      if (!existingChoice) {
        return true;
      }

      if (localChoice.value !== existingChoice.value) {
        return true;
      }
    }
    return false;
  };

  const areOptionsDifferent = (existingOptions, localOptions) => {
    for (const localOption of localOptions) {
      const existingOption = existingOptions?.find(
        (option) => option.name === localOption.name,
      );

      if (!existingOption) {
        return true;
      }

      if (
        localOption.description !== existingOption.description ||
        localOption.type !== existingOption.type ||
        // Normalize both sides: Discord omits `required` for optional options,
        // so comparing `false` against `undefined` would report a phantom diff
        // and re-edit the command on every startup.
        (localOption.required || false) !==
          (existingOption.required || false) ||
        // Same normalization: Discord omits `autocomplete` when it is off.
        // Without this, turning autocomplete on or off on an existing
        // option would never propagate to the registered command.
        (localOption.autocomplete || false) !==
          (existingOption.autocomplete || false) ||
        (localOption.choices?.length || 0) !==
          (existingOption.choices?.length || 0) ||
        areChoicesDifferent(
          localOption.choices || [],
          existingOption.choices || [],
        ) ||
        // Recurse into subcommand and subcommand-group options. Without
        // this, adding or changing an option *nested under* an existing
        // subcommand looks identical to Discord and never re-registers.
        (localOption.options?.length || 0) !==
          (existingOption.options?.length || 0) ||
        areOptionsDifferent(
          existingOption.options || [],
          localOption.options || [],
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const localType = localCommand.type || 1;
  const existingType = existingCommand.type || 1;

  if (localType !== existingType) return true;

  if (localType === 1) {
    if (
      existingCommand.description !== localCommand.description ||
      existingCommand.options?.length !== (localCommand.options?.length || 0) ||
      areOptionsDifferent(existingCommand.options, localCommand.options || [])
    ) {
      return true;
    }
  }

  return false;
};
