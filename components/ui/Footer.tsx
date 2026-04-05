export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-4 px-6 flex items-center justify-between">
      <span className="label-tag">
        <span className="text-blue-light">AI</span>-Group &copy; {new Date().getFullYear()}
      </span>
      <span className="label-tag tracking-[0.2em]">AI-FIRST · WE SHIP FAST</span>
    </footer>
  );
}
