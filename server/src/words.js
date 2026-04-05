export const WORD_PRESETS = {
  random: ['banana astronaut', 'dancing shark', 'haunted toaster', 'angry cloud', 'sleepy dragon', 'flying pizza', 'wizard cat', 'disco potato'],
  animals: ['penguin chef', 'gorilla on a scooter', 'cow in sunglasses', 'llama detective', 'hamster king'],
  jobs: ['ninja dentist', 'pirate teacher', 'astronaut baker', 'robot plumber', 'wizard accountant']
};

export const randomWord = (customWords = [], preset = 'random') => {
  const fromCustom = customWords.filter(Boolean);
  const source = fromCustom.length ? fromCustom : WORD_PRESETS[preset] || WORD_PRESETS.random;
  return source[Math.floor(Math.random() * source.length)];
};
