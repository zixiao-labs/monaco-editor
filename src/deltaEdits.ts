/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation and Zixiao Laboratories. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { editor, IDisposable } from './editor';

/**
 * Identifies the driver transaction that changed a model. Monaco's native
 * content-change event intentionally has no source field, which makes a
 * collaboration adapter unable to distinguish a remote projection from a new
 * local edit without fragile global suppression flags.
 */
export interface IModelEditSource {
	readonly kind: 'agent' | 'collab' | 'remote';
	readonly driverId: string;
	readonly deltaIds?: readonly string[];
}

export interface ISourcedModelContentChangedEvent {
	readonly event: editor.IModelContentChangedEvent;
	/**
	 * Undefined means the edit originated through Monaco itself (typing, undo,
	 * formatting, and other editor commands).
	 */
	readonly source: IModelEditSource | undefined;
}

/**
 * A minimal collaboration boundary around an ITextModel.
 *
 * Events are synchronous in Monaco, so source metadata only needs to live for
 * the duration of `withSource`. The adapter does not alter the model, undo
 * stack, or public content-change event contract.
 */
export class SourcedTextModel implements IDisposable {
	private readonly listeners = new Set<(event: ISourcedModelContentChangedEvent) => void>();
	private readonly sources: IModelEditSource[] = [];
	private readonly modelSubscription: IDisposable;
	private disposed = false;

	constructor(readonly model: editor.ITextModel) {
		this.modelSubscription = model.onDidChangeContent((event) => {
			const sourcedEvent: ISourcedModelContentChangedEvent = {
				event,
				source: this.sources[this.sources.length - 1]
			};
			this.listeners.forEach((listener) => listener(sourcedEvent));
		});
	}

	onDidChangeContent(listener: (event: ISourcedModelContentChangedEvent) => void): IDisposable {
		this.assertNotDisposed();
		this.listeners.add(listener);
		return {
			dispose: () => this.listeners.delete(listener)
		};
	}

	/**
	 * Applies a remote or agent-authored projection without adding it to the
	 * normal Monaco undo stack, while preserving its driver source on the event.
	 */
	applyEdits(
		source: IModelEditSource,
		operations: readonly editor.IIdentifiedSingleEditOperation[]
	): void;
	applyEdits(
		source: IModelEditSource,
		operations: readonly editor.IIdentifiedSingleEditOperation[],
		computeUndoEdits: true
	): editor.IValidEditOperation[];
	applyEdits(
		source: IModelEditSource,
		operations: readonly editor.IIdentifiedSingleEditOperation[],
		computeUndoEdits = false
	): editor.IValidEditOperation[] | void {
		return this.withSource(source, () =>
			computeUndoEdits ? this.model.applyEdits(operations, true) : this.model.applyEdits(operations)
		);
	}

	/**
	 * Tags any synchronous model operation, including `setValue` or a custom
	 * projection algorithm. Nested operations use the innermost source.
	 */
	withSource<T>(source: IModelEditSource, operation: () => T): T {
		this.assertNotDisposed();
		this.sources.push(source);
		try {
			return operation();
		} finally {
			this.sources.pop();
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.modelSubscription.dispose();
		this.listeners.clear();
		this.sources.length = 0;
	}

	private assertNotDisposed(): void {
		if (this.disposed) {
			throw new Error('SourcedTextModel is disposed');
		}
	}
}
