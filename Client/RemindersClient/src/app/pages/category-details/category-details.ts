import { Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, combineLatest, distinctUntilChanged, finalize, map, of, shareReplay, startWith, switchMap } from 'rxjs';
import { CategoriesService, RemindersService } from '../../api/services';
import { CategoryInfoViewDto } from '../../api/models/category-info-view-dto';
import { CategoryListViewDto } from '../../api/models/category-list-view-dto';
import { ReminderListViewDto } from '../../api/models/reminder-list-view-dto';
import { ReminderCard } from '../../components/reminder-card/reminder-card';

type CategoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; id: string; category: CategoryInfoViewDto }
  | { kind: 'error'; title: string; message: string; retry: boolean };
type CategoryRemindersState =
  | { kind: 'idle' | 'loading' }
  | { kind: 'ready'; reminders: ReminderListViewDto[] }
  | { kind: 'error' };

@Component({
  selector: 'app-category-details',
  imports: [RouterLink, ReminderCard, ReactiveFormsModule],
  templateUrl: './category-details.html',
  styleUrls: ['../../shared/details-page.css', '../../shared/details-navigation.css', './category-details.css'],
})
export class CategoryDetails {
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationDialog = viewChild.required<ElementRef<HTMLDialogElement>>('categoryNavigationDialog');
  private readonly categoriesApi = inject(CategoriesService);
  private readonly remindersApi = inject(RemindersService);
  private readonly route = inject(ActivatedRoute);
  private readonly reloadCategory = new Subject<void>();
  private readonly reloadReminders = new Subject<void>();
  private readonly routeId = this.route.paramMap.pipe(
    map(params => params.get('id') ?? ''), distinctUntilChanged(),
  );
  private readonly dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  private readonly categoryState = combineLatest([
    this.routeId, this.reloadCategory.pipe(startWith(undefined)),
  ]).pipe(
    switchMap(([id]) => this.categoriesApi.apiV1CategoriesCategoryIdGet$Json({ categoryId: id }).pipe(
      map(category => ({ kind: 'ready', id, category }) as CategoryState),
      catchError((error: {status?: number}) => of<CategoryState>(
        error.status === 400 || error.status === 404
          ? {kind: 'error', title: 'Категория не найдена', message: 'Возможно, она удалена или у вас нет доступа к ней.', retry: false}
          : error.status === 403
            ? {kind: 'error', title: 'Нет доступа к категории', message: 'Вернитесь к списку и выберите другую категорию.', retry: false}
            : {kind: 'error', title: 'Не удалось загрузить категорию', message: 'Проверьте соединение и попробуйте ещё раз.', retry: true},
      )),
      startWith<CategoryState>({kind: 'loading'}),
    )),
    shareReplay({bufferSize: 1, refCount: true}),
  );

  readonly categoryId = toSignal(this.routeId, {initialValue: this.route.snapshot.paramMap.get('id') ?? ''});
  readonly state = toSignal(this.categoryState, {initialValue: {kind: 'loading'} as CategoryState});
  readonly remindersState = toSignal(combineLatest([
    this.categoryState, this.reloadReminders.pipe(startWith(undefined)),
  ]).pipe(
    switchMap(([state]) => state.kind !== 'ready'
      ? of<CategoryRemindersState>({kind: 'idle'})
      : this.remindersApi.apiV1RemindersSearchPost$Json({body: {categoryIds: [state.id]}}).pipe(
        map(reminders => ({kind: 'ready', reminders}) as CategoryRemindersState),
        catchError(() => of<CategoryRemindersState>({kind: 'error'})),
        startWith<CategoryRemindersState>({kind: 'loading'}),
      ),
    ),
  ), {initialValue: {kind: 'idle'} as CategoryRemindersState});

  retryCategory(): void { this.reloadCategory.next(); }
  retryReminders(): void { this.reloadReminders.next(); }

  readonly navigationCategories = signal<CategoryListViewDto[]>([]);
  readonly navigationLoading = signal(false);
  readonly navigationError = signal<string | null>(null);
  private navigationLoaded = false;
  readonly navigationSearch = new FormControl('', {nonNullable: true});
  private readonly searchText = toSignal(this.navigationSearch.valueChanges, {initialValue: ''});
  readonly filteredCategories = computed(() => {
    const search = this.searchText().trim().toLocaleLowerCase('ru');
    return this.navigationCategories().filter(category =>
      category.id && (category.title || 'Без названия').toLocaleLowerCase('ru').includes(search),
    );
  });

  openNavigation(): void {
    this.navigationSearch.reset();
    this.navigationDialog().nativeElement.showModal();
    if (!this.navigationLoaded) this.loadNavigation();
  }

  closeNavigation(): void { this.navigationDialog().nativeElement.close(); }

  loadNavigation(): void {
    if (this.navigationLoading()) return;
    this.navigationLoading.set(true);
    this.navigationError.set(null);
    this.categoriesApi.apiV1CategoriesGet$Json().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.navigationLoading.set(false)),
    ).subscribe({
      next: categories => {
        this.navigationCategories.set(categories);
        this.navigationLoaded = true;
      },
      error: () => this.navigationError.set('Не удалось загрузить список категорий.'),
    });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Не указана';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Не указана' : this.dateFormatter.format(date);
  }
}
