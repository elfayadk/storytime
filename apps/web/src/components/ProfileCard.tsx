import type { Profile } from '../types';

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(+d) ? null : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const joined = fmtDate(profile.joined);
  return (
    <section className="panel profilecard">
      {profile.avatarUrl ? <img className="avatar" src={profile.avatarUrl} alt="" loading="lazy" /> : null}
      <div className="pinfo">
        <div className="pname">{profile.displayName ?? profile.handle}</div>
        <a className="phandle" href={profile.url} target="_blank" rel="noopener">
          {profile.url.replace(/^https?:\/\//, '')}
        </a>
        {profile.bio ? <p className="pbio">{profile.bio}</p> : null}
        <div className="pmeta">
          {profile.location ? <span>{profile.location}</span> : null}
          {profile.company ? <span>{profile.company}</span> : null}
          {profile.followers != null ? <span>{profile.followers} followers</span> : null}
          {profile.repos != null ? <span>{profile.repos} repos</span> : null}
          {joined ? <span>joined {joined}</span> : null}
        </div>
        {profile.topLanguages?.length ? (
          <div className="chips" style={{ marginTop: 10 }}>
            {profile.topLanguages.map((l) => (
              <span className="chip x" key={l.name}>
                {l.name}
              </span>
            ))}
          </div>
        ) : null}
        {profile.topRepos?.length ? (
          <div className="prepos">
            {profile.topRepos.map((r) => (
              <a className="prepo" key={r.name} href={r.url} target="_blank" rel="noopener">
                <b>{r.name}</b>
                <span className="stars">&#9733; {r.stars}</span>
                {r.description ? <em>{r.description}</em> : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
