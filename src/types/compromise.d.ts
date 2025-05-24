declare module 'compromise' {
  interface View {
    text(): string;
    honorific?: View;
    firstName?: View;
    lastName?: View;
    toISO?(): string;
  }

  interface Doc {
    people(): View[];
    organizations(): View[];
    places(): View[];
    dates(): View[];
    urls(): View[];
    emails(): View[];
    hashTags(): View[];
  }

  function compromise(text: string): Doc;
  export = compromise;
} 