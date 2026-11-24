import PixelIcon from './icons/PixelIcon';
import { grailsEnabled, useGrail, type GrailTarget } from '../lib/grails';

/**
 * The "Grail it" button (D36): the site's own like, with the total next to it. Anyone can
 * grail; the first one signs the visitor in anonymously. Hidden when the build has no
 * Supabase project.
 */
export default function GrailButton({ target }: { target: GrailTarget }) {
  if (!grailsEnabled) return null;
  return <Grail target={target} />;
}

function Grail({ target }: { target: GrailTarget }) {
  const { count, mine, busy, error, toggle } = useGrail(target);
  return (
    <span className="ig-grail">
      <button
        type="button"
        className="ig-btn ig-grail__btn"
        aria-pressed={mine}
        aria-busy={busy || undefined}
        onClick={toggle}
        data-count={count ?? ''}
      >
        <PixelIcon name="grail" size={16} />
        <span>{mine ? 'Grailed' : 'Grail it'}</span>
        {count !== undefined && count > 0 && (
          <span className="ig-grail__count">
            {count.toLocaleString('en-US')}
            <span className="sr-only"> {count === 1 ? 'grail' : 'grails'}</span>
          </span>
        )}
      </button>
      <span className="ig-grail__error" role="status">
        {error ?? ''}
      </span>
    </span>
  );
}
