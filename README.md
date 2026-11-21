# kelus

Kelus helps students revise from the material they were actually taught.

Add a PDF, slides, Notion export, Markdown file, or pasted notes. Kelus finds
study topics, asks short recall questions, checks an explanation against the
original line, and changes the next study plan from what the student showed.

## Why it exists

Most study tools ask students to trust an AI answer or build flashcards by
hand. Kelus keeps the source visible: a question should lead back to the page
or line that supports it.

## Run locally

Requirements: Node 22 and npm.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

Kelus works without an account. Uploaded material is stored locally unless a
student explicitly chooses to sync. Do not commit `.env` files, generated
build output, student documents, or any production credentials.

## Verify a change

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## Project boundaries

- The browser client and local learning flow are open for anyone to study,
  adapt, and improve.
- The optional AI proxy reads its credentials only from deployment secrets.
  It must never receive a key in browser code or a committed environment file.
- Contributors must use test fixtures or openly licensed material—not lecture
  notes, identifiable student data, or copyrighted course packs they cannot
  share.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) before
opening a pull request. The product principles and visual system are described
in [PRODUCT.md](PRODUCT.md) and [design.md](design.md).

## License

[GNU AGPL-3.0-or-later](LICENSE). If you run a modified Kelus as a network
service, the AGPL requires you to offer its source to the people using it.
Kelus is not affiliated with Anki, Quizlet, NotebookLM, or any
educational institution.
