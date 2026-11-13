/** The club crest (public/logo.png). Decorative: the club name always sits next to it. */
export default function Logo({ className }: { className?: string }) {
  return <img className={className} src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={256} height={256} />
}
