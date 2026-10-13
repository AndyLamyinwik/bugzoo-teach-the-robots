import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { ConfirmationDialog } from './ConfirmationDialog';

describe('confirmation dialog presentation boundary', () => {
  it('associates its title and description and places cancel before the destructive action', () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const markup = renderToStaticMarkup(
      <ConfirmationDialog
        open
        title="重設課程"
        description="已保存的教學進度將被清除。"
        confirmLabel="確認重設"
        onConfirm={confirm}
        onCancel={cancel}
      />,
    );
    const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    const descriptionId = markup.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(titleId).toBeDefined();
    expect(descriptionId).toBeDefined();
    expect(markup).toContain(`<h2 id="${titleId}">重設課程</h2>`);
    expect(markup).toContain(`<p id="${descriptionId}">已保存的教學進度將被清除。</p>`);
    expect(markup.indexOf('>取消</button>') < markup.indexOf('>確認重設</button>')).toBe(
      true,
    );
    expect([...markup.matchAll(/type="button"/g)]).toHaveLength(2);
    expect(confirm.mock.calls).toHaveLength(0);
    expect(cancel.mock.calls).toHaveLength(0);
  });

  it('uses the active language for cancel and accepts caller-provided action wording', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider locale="en">
        <ConfirmationDialog
          open
          title="Reset lesson"
          description="Saved progress will be cleared."
          confirmLabel="Clear saved progress"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </I18nProvider>,
    );
    expect(markup).toContain('>Cancel</button>');
    expect(markup).toContain('>Clear saved progress</button>');
    expect(/[\u3400-\u9fff]/.test(markup)).toBe(false);
  });

  it('keeps a closed confirmation out of the open state without invoking either action', () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    const markup = renderToStaticMarkup(
      <ConfirmationDialog
        open={false}
        title="Clear saved progress"
        description="This will clear this lesson only."
        confirmLabel="Clear"
        cancelLabel="Keep progress"
        onConfirm={confirm}
        onCancel={cancel}
      />,
    );
    expect(markup.startsWith('<dialog')).toBe(true);
    expect(markup.includes(' open')).toBe(false);
    expect(markup).toContain('>Keep progress</button>');
    expect(confirm.mock.calls).toHaveLength(0);
    expect(cancel.mock.calls).toHaveLength(0);
  });
});
